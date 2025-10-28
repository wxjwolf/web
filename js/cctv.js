// 央视新闻APP官源解析
function main(item) {
    try {
        const id = ku9.getQuery(item.url, "id") || 'cctv1';
        const result = getM3u8UrlAndContent(id);
        
        if (result.error) {
            return { error: result.error };
        }
        
        const { url, content } = result;
        const processedContent = replaceTsUrls(url, content);
        
        return {
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Content-Type': 'application/vnd.apple.mpegurl'
            },
            m3u8: processedContent
        };
        
    } catch (error) {
        return { error: "处理失败: " + error.message };
    }
}

// 获取频道映射
function getChannel(id) {
    const channelMap = {
        'cctv1': '11200132825562653886',
        'cctv2': '12030532124776958103',
        'cctv4': '10620168294224708952',
        'cctv7': '8516529981177953694',
        'cctv9': '7252237247689203957',
        'cctv10': '14589146016461298119',
        'cctv12': '13180385922471124325',
        'cctv13': '16265686808730585228',
        'cctv17': '4496917190172866934',
        'cctv4k': '2127841942201075403',
    };
    return channelMap[id] || channelMap['cctv1'];
}

// 获取M3U8 URL和内容
function getM3u8UrlAndContent(id) {
    // 尝试从缓存获取
    const cachedUrl = loadFromCache(id);
    if (cachedUrl) {
        console.info("从缓存获取URL: " + cachedUrl);
        const response = sendRequest(cachedUrl);
        if (response.code === 200) {
            return { url: cachedUrl, content: response.body };
        }
        console.info("缓存URL已失效，重新获取");
    }
    
    // 从网络获取
    const url = getM3u8UrlFromWeb(id);
    console.info("从网络获取URL: " + url);
    const response = sendRequest(url);
    
    if (response.code !== 200) {
        throw new Error("获取M3U8内容失败: HTTP " + response.code);
    }
    
    // 保存到缓存
    saveToCache(id, url);
    
    return { url: url, content: response.body };
}

// 从网络获取M3U8 URL
function getM3u8UrlFromWeb(id) {
    return getM3u8UrlFromWebCore(id);
}

// 保存到缓存
function saveToCache(id, m3u8Url) {
    try {
        const cacheKey = `cctvnews_${id}_url`;
        const cacheData = {
            url: m3u8Url,
            timestamp: Date.now()
        };
        ku9.setCache(cacheKey, cacheData, 60); // 缓存60秒
        console.info("已保存到缓存: " + id);
    } catch (e) {
        console.info("缓存保存失败: " + e.message);
    }
}

// 从缓存加载
function loadFromCache(id) {
    try {
        const cacheKey = `cctvnews_${id}_url`;
        const cachedData = ku9.getCache(cacheKey);
        
        if (cachedData && cachedData.url && cachedData.timestamp) {
            // 检查缓存是否过期（60秒）
            const now = Date.now();
            if (now - cachedData.timestamp < 60000) {
                return cachedData.url;
            }
        }
    } catch (e) {
        console.info("缓存读取失败: " + e.message);
    }
    return null;
}

// 替换TS URLs
function replaceTsUrls(m3u8Url, m3u8Content) {
    const destTsPath = m3u8Url.substring(0, m3u8Url.lastIndexOf('/') + 1);
    const lines = m3u8Content.split('\n');
    const newLines = [];
    
    for (const line of lines) {
        const trimmed = line.trim();
        
        if (!trimmed || trimmed.startsWith('#')) {
            newLines.push(line);
            continue;
        }
        
        // 处理TS URL
        if (isAbsoluteUrl(trimmed)) {
            newLines.push(trimmed);
        } else {
            newLines.push(destTsPath + trimmed);
        }
    }
    
    return newLines.join('\n');
}

// 检查是否为绝对URL
function isAbsoluteUrl(url) {
    return url.startsWith('http:') || url.startsWith('https:');
}

// 核心获取M3U8 URL逻辑
function getM3u8UrlFromWebCore(id) {
    const CryptoJS = require("crypto");
    
    const room = getChannel(id);
    const url = `https://gateway2.cctvnews.cctv.com/1.0.0/feed/article/live/detail?articleId=${room}&scene_type=6`;
    const t = Date.now();
    const er = `GET\napplication/json\n\n\n\nx-ca-key:204133710\nx-ca-stage:RELEASE\nx-ca-timestamp:${t}\n/1.0.0/feed/article/live/detail?articleId=${room}&scene_type=6`;
    const es = 'etyEuNdA7GvQU7iPZHqnrBpSFfRyKQTD';
    
    // 生成签名
    const sign = CryptoJS.HmacSHA256(er, es).toString(CryptoJS.enc.Base64);
    const clientId = createUuid();
    const xReqTs = t - 1;
    
    const headers = {
        'accept': 'application/json',
        'cookieuid': clientId,
        'from-client': 'h5',
        'userid': clientId,
        'x-ca-key': '204133710',
        'x-ca-stage': 'RELEASE',
        'x-ca-signature': sign,
        'x-ca-signature-headers': 'x-ca-key,x-ca-stage,x-ca-timestamp',
        'x-ca-timestamp': t.toString(),
        'x-req-ts': xReqTs.toString(),
        'x-request-id': clientId,
        'referer': 'https://m-live.cctvnews.cctv.com/',
        'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36'
    };
    
    const response = sendRequest(url, headers);
    let jsonData;
    try {
        jsonData = JSON.parse(response.body);
    } catch (e) {
        throw new Error("JSON解析失败: " + e.message);
    }
    
    // 解码响应
    const decodedResponse = CryptoJS.enc.Base64.parse(jsonData.response).toString(CryptoJS.enc.Utf8);
    const responseData = JSON.parse(decodedResponse);
    const data = responseData.data;
    
    const authUrl = data.live_room.liveCameraList[0].pullUrlList[0].authResultUrl[0].authUrl;
    let liveUrl;
    
    if (authUrl.startsWith('http')) {
        liveUrl = authUrl;
    } else {
        const dk = data.dk;
        liveUrl = decrypt(authUrl, dk, xReqTs);
    }
    
    // 替换https为http
    return liveUrl.replace('https:', 'http:');
}

// 创建UUID
function createUuid() {
    const parts = [
        randomHex(8),
        randomHex(4),
        '4' + randomHex(3),
        ((Math.floor(Math.random() * 4) + 8).toString(16) + randomHex(3)),
        randomHex(12)
    ];
    return parts.join('');
}

function randomHex(length) {
    let result = '';
    const chars = '0123456789abcdef';
    for (let i = 0; i < length; i++) {
        result += chars[Math.floor(Math.random() * chars.length)];
    }
    return result;
}

// 发送请求
function sendRequest(url, headers = null, postData = null) {
    const defaultHeaders = {
        'referer': 'https://m-live.cctvnews.cctv.com/',
        'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36'
    };
    
    const finalHeaders = { ...defaultHeaders, ...headers };
    const method = postData ? 'POST' : 'GET';
    
    try {
        const response = ku9.request(url, method, finalHeaders, postData, false);
        return {
            body: response.body,
            code: response.code,
            headers: response.headers || {}
        };
    } catch (error) {
        throw new Error("请求失败: " + error.message);
    }
}

// 解密函数
function decrypt(authUrl, dk, xReqTs) {
    const key = getKey(dk, xReqTs);
    const iv = getIv(dk, xReqTs);
    return aesCbcDecrypt(authUrl, key, iv);
}

function getIv(dk, xReqTs) {
    const eo = xReqTs.toString().substring(0, xReqTs.toString().length - 3);
    return dk.substring(dk.length - 8) + eo.substring(0, 8);
}

function getKey(dk, xReqTs) {
    const eo = xReqTs.toString().substring(0, xReqTs.toString().length - 3);
    return dk.substring(0, 8) + eo.substring(eo.length - 8);
}

function aesCbcDecrypt(encryptedData, key, iv) {
    const CryptoJS = require("crypto");
    
    // Base64解码
    const encryptedBytes = CryptoJS.enc.Base64.parse(encryptedData);
    
    // 解析key和iv
    const keyBytes = CryptoJS.enc.Utf8.parse(key);
    const ivBytes = CryptoJS.enc.Utf8.parse(iv);
    
    // AES-CBC解密
    const decrypted = CryptoJS.AES.decrypt(
        { ciphertext: encryptedBytes },
        keyBytes,
        { 
            iv: ivBytes,
            mode: CryptoJS.mode.CBC,
            padding: CryptoJS.pad.Pkcs7
        }
    );
    
    return decrypted.toString(CryptoJS.enc.Utf8);
}
