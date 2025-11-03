/**
 * Vertex AI Full 모드 인증을 위한 JWT 생성 및 Access Token 획득
 * Web Crypto API를 사용하여 브라우저에서도 Service Account 인증 가능
 */

/**
 * Base64URL 인코딩 (표준 base64와 다름: + -> -, / -> _, = 제거)
 */
function base64UrlEncode(str) {
    return btoa(str)
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=/g, '');
}

/**
 * Base64URL 디코딩
 */
function base64UrlDecode(str) {
    // Base64URL을 표준 Base64로 변환
    str = str.replace(/-/g, '+').replace(/_/g, '/');
    // 패딩 추가
    while (str.length % 4) {
        str += '=';
    }
    return atob(str);
}

/**
 * PEM 형식의 private key를 Web Crypto API에서 사용할 수 있는 형식(ArrayBuffer)으로 변환
 */
async function parsePrivateKey(pemKey) {
    // PEM 헤더/푸터 제거
    const keyData = pemKey
        .replace(/-----BEGIN PRIVATE KEY-----/g, '')
        .replace(/-----END PRIVATE KEY-----/g, '')
        .replace(/-----BEGIN RSA PRIVATE KEY-----/g, '')
        .replace(/-----END RSA PRIVATE KEY-----/g, '')
        .replace(/\s/g, '');

    // Base64 디코딩 (표준 base64 디코딩)
    const binaryString = atob(keyData);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }

    return bytes.buffer;
}

/**
 * Service Account JSON으로부터 JWT 토큰 생성
 * @param {object} serviceAccount - Service Account JSON 객체
 * @returns {Promise<string>} JWT 토큰
 */
async function generateJWTToken(serviceAccount) {
    const now = Math.floor(Date.now() / 1000);
    const expiry = now + 3600; // 1시간 유효

    const header = {
        alg: 'RS256',
        typ: 'JWT',
    };

    const payload = {
        iss: serviceAccount.client_email,
        scope: 'https://www.googleapis.com/auth/cloud-platform',
        aud: 'https://oauth2.googleapis.com/token',
        iat: now,
        exp: expiry,
    };

    // Base64URL 인코딩
    const headerBase64 = base64UrlEncode(JSON.stringify(header));
    const payloadBase64 = base64UrlEncode(JSON.stringify(payload));
    const signatureInput = `${headerBase64}.${payloadBase64}`;

    // Private Key를 CryptoKey로 변환
    const privateKeyPem = serviceAccount.private_key;
    const keyData = await parsePrivateKey(privateKeyPem);

    // Web Crypto API를 사용하여 키 import
    const cryptoKey = await crypto.subtle.importKey(
        'pkcs8',
        keyData,
        {
            name: 'RSASSA-PKCS1-v1_5',
            hash: 'SHA-256',
        },
        false,
        ['sign']
    );

    // 서명 생성
    const signature = await crypto.subtle.sign(
        'RSASSA-PKCS1-v1_5',
        cryptoKey,
        new TextEncoder().encode(signatureInput)
    );

    // ArrayBuffer를 Uint8Array로 변환 후 Base64URL 인코딩
    const signatureArray = new Uint8Array(signature);
    const signatureBase64 = base64UrlEncode(
        String.fromCharCode.apply(null, Array.from(signatureArray))
    );

    return `${signatureInput}.${signatureBase64}`;
}

/**
 * JWT 토큰으로부터 Google OAuth2 Access Token 획득
 * @param {string} jwtToken - JWT 토큰
 * @returns {Promise<string>} Access Token
 */
async function getAccessToken(jwtToken) {
    const response = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
            grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
            assertion: jwtToken,
        }),
    });

    if (!response.ok) {
        const error = await response.text();
        throw new Error(`Failed to get access token: ${error}`);
    }

    const data = await response.json();
    return data.access_token;
}

/**
 * Service Account JSON으로부터 Project ID 추출
 * @param {object} serviceAccount - Service Account JSON 객체
 * @returns {string} Project ID
 */
function getProjectIdFromServiceAccount(serviceAccount) {
    if (!serviceAccount || typeof serviceAccount !== 'object') {
        throw new Error('Invalid service account object');
    }

    const projectId = serviceAccount.project_id;
    if (!projectId || typeof projectId !== 'string') {
        throw new Error('Project ID not found in service account JSON');
    }

    return projectId;
}

