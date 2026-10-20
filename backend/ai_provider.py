"""Gemini REST adapter. No deprecated SDK; key only in x-goog-api-key.
404, key rejection, quota and outages are distinct; secrets are never echoed.
"""
import json
import asyncio
import re
import time
from fastapi import HTTPException
import httpx
import store

BASE='https://generativelanguage.googleapis.com/v1beta'
CACHE={}
STATE={'engine':'rules','last_error':None,'last_success':None,'resolved_model':None}

class ProviderError(HTTPException):
    def __init__(self,message,provider_status=None,kind='provider_error'):
        self.provider_status=provider_status;self.kind=kind
        STATE['last_error']={'kind':kind,'provider_status':provider_status,'message':message,'at':time.time()}
        super().__init__(status_code=503 if provider_status in (429,503) else 502,detail=message)

def require_key():
    key=store.api_key()
    if not key:raise HTTPException(503,'Ключ Gemini не настроен. Сохраните его в админ-панели.')
    if not key.isascii() or any(ord(c)<33 or ord(c)>126 for c in key):
        raise ProviderError('В API-ключ попали пробелы, управляющие или не-ASCII символы. Скопируйте ключ целиком без поясняющего текста.',None,'invalid_key_format')
    return key

def provider_error(response):
    code=response.status_code
    # Inspect only to classify; do not return provider bodies (they can contain key text).
    try:text=json.dumps(response.json()).casefold()
    except ValueError:text=''
    if 'leaked' in text or 'reported as leaked' in text:
        return ProviderError('Google сообщил, что ключ скомпрометирован. Создайте новый ключ в AI Studio; повторные запросы этим ключом не помогут.',code,'leaked_key')
    if code in (401,403):return ProviderError('Google отклонил авторизацию. Проверьте ключ, его ограничения и доступ проекта к Gemini Developer API.',code,'authorization')
    if code==404:return ProviderError('Модель или ресурс не найдены (Google HTTP 404). Обновите список доступных моделей в админ-панели. Не подбирайте имя модели наугад.',code,'model_not_found')
    if code==429:return ProviderError('Квота Gemini исчерпана или превышен лимит запросов. Проверьте квоту и биллинг, затем повторите позже.',code,'quota')
    if code==400:return ProviderError('Google отклонил запрос (HTTP 400): проверьте тип ключа, выбранную модель и поддержку JSON-ответов.',code,'invalid_request')
    if code>=500:return ProviderError('Gemini временно недоступен. Локальный помощник продолжает работать.',code,'unavailable')
    return ProviderError(f'Ошибка Gemini: HTTP {code}. Проверьте подключение в админ-панели.',code)

def clear_cache():
    CACHE.clear()

def cache_key(key):
    import hashlib
    return hashlib.sha256(key.encode()).hexdigest()

async def models(request,refresh=False):
    key=require_key();ident=cache_key(key)
    cached=CACHE.get(ident)
    if cached and not refresh and time.monotonic()-cached['at']<300:return cached['models']
    result=[];token=None
    try:
        for _ in range(10):
            params={'pageSize':1000}
            if token:params['pageToken']=token
            r=await request.app.state.http.get(BASE+'/models',params=params,headers={'x-goog-api-key':key},timeout=15)
            if r.status_code!=200:raise provider_error(r)
            data=r.json()
            for m in data.get('models',[]):
                ident_name=m.get('name','').removeprefix('models/')
                if not re.fullmatch(r'[A-Za-z0-9._-]{3,100}',ident_name):continue
                if not ident_name.startswith('gemini-') or 'generateContent' not in m.get('supportedGenerationMethods',[]):continue
                if any(word in ident_name.lower() for word in ('image','tts','audio','robotics','computer-use','embedding','veo')):continue
                result.append({'id':ident_name,'label':m.get('displayName',ident_name),'description':m.get('description','')[:500]})
            token=data.get('nextPageToken')
            if not token:break
        else:raise ProviderError('Список моделей слишком большой. Уточните настройки проекта.',None,'pagination_limit')
    except httpx.HTTPError:raise ProviderError('Нет связи с Gemini. Проверьте доступ к generativelanguage.googleapis.com.',None,'network')
    except (ValueError,TypeError,AttributeError):raise ProviderError('Google вернул некорректный список моделей.',None,'invalid_response')
    unique={m['id']:m for m in result};result=list(unique.values())
    if not result:raise ProviderError('Для этого ключа не найдены текстовые модели с generateContent. Проверьте проект и тип API.',None,'no_models')
    CACHE[ident]={'at':time.monotonic(),'models':result}
    return result

def auto_pick(available):
    def rank(m):
        name=m['id'].lower();version=re.search(r'gemini-(\d+)(?:\.(\d+))?',name)
        version=tuple(int(x or 0) for x in version.groups()) if version else (0,0)
        return ('flash' in name,'preview' not in name and 'exp' not in name,version,'lite' not in name,name)
    return max(available,key=rank)['id']

async def resolve_model(request):
    available=await models(request)
    selected=store.settings()['model']
    if selected=='auto':return auto_pick(available)
    if selected not in {m['id'] for m in available}:
        raise ProviderError('Сохраненная модель недоступна для этого ключа. Загрузите список моделей и выберите доступную либо режим «Авто».',404,'model_not_available')
    return selected

FALLBACK_MODELS=['gemini-2.5-flash','gemini-2.0-flash','gemini-2.5-flash-lite','gemini-1.5-flash-latest']

def parse_response(raw_text):
    """Decode a JSON envelope; text recovery is allowed ONLY by a dialogue consumer."""
    text=re.sub(r'^\s*```(?:json)?\s*|\s*```\s*$','',raw_text.strip(),flags=re.I)
    match=re.search(r'\{.*\}',text,re.DOTALL)
    if match:
        try:
            value=json.loads(match.group())
            if isinstance(value,dict):return value
        except (ValueError,TypeError):
            # A trailing explanation can contain another brace: try each object boundary.
            decoder=json.JSONDecoder()
            for offset,c in enumerate(text):
                if c=='{':
                    try:
                        value,_=decoder.raw_decode(text[offset:])
                        if isinstance(value,dict):return value
                    except ValueError:pass
    if len(text)>=8 and not text.startswith(('{','[','<','```')) and re.search(r'[^\W\d_]',text):
        import dining
        prefs=dining.parse(text)
        safe=dining.select(dining.eligible(),prefs,{})
        hits=[d['id'] for d in safe if d['name'].casefold() in text.casefold()]
        return {'reply':text[:2000],'dishes':hits or [d['id'] for d in safe[:3]],'_plain_text':True}
    raise ValueError('No complete JSON or natural text')

async def generate(request,prompt):
    key=require_key();configured=store.settings().get('model','auto')
    chain=[]
    if configured!='auto':chain.append(configured.removeprefix('models/'))
    else:
        try:
            # Model discovery is an optimization, NEVER a prerequisite for generation.
            async with asyncio.timeout(3):chain.append(await resolve_model(request))
        except (HTTPException,TimeoutError,httpx.HTTPError):pass
    chain=list(dict.fromkeys(chain+FALLBACK_MODELS))
    attempts=[];deadline=time.monotonic()+24;last=None
    for model in chain:
        if not re.fullmatch(r'[A-Za-z0-9._-]{3,100}',model):continue
        remaining=deadline-time.monotonic()
        if remaining<=0:break
        try:
            async with asyncio.timeout(min(7,remaining)):
                r=await request.app.state.http.post(BASE+f'/models/{model}:generateContent',headers={'x-goog-api-key':key},json={'contents':[{'parts':[{'text':prompt}]}],'generationConfig':{'responseMimeType':'application/json','temperature':0.35,'maxOutputTokens':8192}},timeout=min(7,remaining))
            attempts.append({'model':model,'status':r.status_code})
            if r.status_code!=200:
                last=provider_error(r)
                if last.kind in ('authorization','leaked_key') or r.status_code not in (400,404,429,500,502,503,504):raise last
                continue
            data=r.json();candidates=data.get('candidates') or []
            if not candidates:raise ValueError('empty candidates')
            candidate=candidates[0]
            if candidate.get('finishReason') not in ('STOP',None):raise ValueError('incomplete or blocked')
            text=''.join(p.get('text','') for p in candidate.get('content',{}).get('parts',[]) if not p.get('thought'))
            parsed=parse_response(text)
            STATE.update(engine='gemini',last_error=None,last_success=time.time(),resolved_model=model,attempts=attempts)
            return parsed
        except ProviderError:raise
        except (httpx.HTTPError,TimeoutError):
            attempts.append({'model':model,'status':'timeout_or_network'});last=ProviderError('Временная ошибка сети Gemini.',None,'network')
        except (ValueError,TypeError,AttributeError):
            last=ProviderError('Gemini вернул неполный, заблокированный или нечитаемый ответ.',None,'invalid_response')
    STATE.update(engine='rules',attempts=attempts)
    raise last or ProviderError('Все доступные модели Gemini временно недоступны.',503,'unavailable')
