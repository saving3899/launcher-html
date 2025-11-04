/**
 * PNG 인코더 (Chara Card V2 형식 지원)
 * PNG 파일에 JSON 데이터를 임베드하는 유틸리티
 */

/**
 * CRC32 계산
 * @param {Uint8Array} data - 데이터
 * @param {number} previous - 이전 CRC 값 (기본값: 0xFFFFFFFF)
 * @returns {number} CRC32 값
 */
function crc32(data, previous = 0xFFFFFFFF) {
    const table = [];
    for (let i = 0; i < 256; i++) {
        let c = i;
        for (let j = 0; j < 8; j++) {
            c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
        }
        table[i] = c;
    }
    
    let crc = previous;
    for (let i = 0; i < data.length; i++) {
        crc = table[(crc ^ data[i]) & 0xFF] ^ (crc >>> 8);
    }
    return crc ^ 0xFFFFFFFF;
}

/**
 * PNG 청크 생성
 * @param {string} name - 청크 이름 (4자)
 * @param {Uint8Array} data - 청크 데이터
 * @returns {Uint8Array} 인코딩된 청크
 */
function createChunk(name, data) {
    const nameBytes = new Uint8Array(4);
    for (let i = 0; i < 4; i++) {
        nameBytes[i] = name.charCodeAt(i);
    }
    
    const length = data.length;
    const chunk = new Uint8Array(12 + length);
    
    // 길이 (빅엔디안)
    chunk[0] = (length >>> 24) & 0xFF;
    chunk[1] = (length >>> 16) & 0xFF;
    chunk[2] = (length >>> 8) & 0xFF;
    chunk[3] = length & 0xFF;
    
    // 청크 타입 (이름)
    chunk[4] = nameBytes[0];
    chunk[5] = nameBytes[1];
    chunk[6] = nameBytes[2];
    chunk[7] = nameBytes[3];
    
    // 데이터
    for (let i = 0; i < length; i++) {
        chunk[8 + i] = data[i];
    }
    
    // CRC32 계산 (이름 + 데이터)
    const crcData = new Uint8Array(4 + length);
    for (let i = 0; i < 4; i++) {
        crcData[i] = nameBytes[i];
    }
    for (let i = 0; i < length; i++) {
        crcData[4 + i] = data[i];
    }
    const crc = crc32(crcData);
    
    // CRC (빅엔디안)
    chunk[8 + length] = (crc >>> 24) & 0xFF;
    chunk[9 + length] = (crc >>> 16) & 0xFF;
    chunk[10 + length] = (crc >>> 8) & 0xFF;
    chunk[11 + length] = crc & 0xFF;
    
    return chunk;
}

/**
 * PNG 청크 파싱
 * @param {Uint8Array} data - PNG 데이터
 * @param {number} offset - 시작 오프셋
 * @returns {object|null} 청크 정보 { name, data, length } 또는 null
 */
function parseChunk(data, offset) {
    if (offset + 12 > data.length) {
        return null;
    }
    
    // 길이 읽기 (빅엔디안)
    const length = (data[offset] << 24) | (data[offset + 1] << 16) | (data[offset + 2] << 8) | data[offset + 3];
    
    // 청크 이름 읽기
    const name = String.fromCharCode(data[offset + 4], data[offset + 5], data[offset + 6], data[offset + 7]);
    
    // 데이터 읽기
    const chunkData = data.slice(offset + 8, offset + 8 + length);
    
    return {
        name,
        data: chunkData,
        totalLength: 12 + length,
    };
}

/**
 * PNG 파일에 JSON 데이터 임베드 (Chara Card V2 형식)
 * @param {Uint8Array|Blob|string} imageData - PNG 이미지 데이터 (Data URL, Blob, 또는 Uint8Array)
 * @param {object|string} jsonData - 임베드할 JSON 데이터 (객체 또는 JSON 문자열)
 * @returns {Promise<Uint8Array>} 임베드된 PNG 데이터
 */
async function embedDataInPng(imageData, jsonData) {
    // 이미지 데이터를 Uint8Array로 변환
    let imageBytes;
    
    if (typeof imageData === 'string') {
        // Data URL인 경우
        if (imageData.startsWith('data:image/png;base64,')) {
            const base64 = imageData.split(',')[1];
            const binaryString = atob(base64);
            imageBytes = new Uint8Array(binaryString.length);
            for (let i = 0; i < binaryString.length; i++) {
                imageBytes[i] = binaryString.charCodeAt(i);
            }
        } else {
            throw new Error('지원하지 않는 이미지 형식입니다.');
        }
    } else if (imageData instanceof Blob) {
        const arrayBuffer = await imageData.arrayBuffer();
        imageBytes = new Uint8Array(arrayBuffer);
    } else if (imageData instanceof Uint8Array) {
        imageBytes = imageData;
    } else {
        throw new Error('지원하지 않는 이미지 데이터 형식입니다.');
    }
    
    // PNG 시그니처 검증
    if (imageBytes.length < 8 || 
        imageBytes[0] !== 0x89 || imageBytes[1] !== 0x50 || imageBytes[2] !== 0x4E || imageBytes[3] !== 0x47 ||
        imageBytes[4] !== 0x0D || imageBytes[5] !== 0x0A || imageBytes[6] !== 0x1A || imageBytes[7] !== 0x0A) {
        throw new Error('유효하지 않은 PNG 파일입니다.');
    }
    
    // JSON 문자열로 변환
    const jsonString = typeof jsonData === 'string' ? jsonData : JSON.stringify(jsonData);
    
    // Base64 인코딩 (큰 배열에 대한 스택 오버플로우 방지)
    const encoder = new TextEncoder();
    const utf8Bytes = encoder.encode(jsonString);
    
    // 큰 배열을 스프레드 연산자나 apply로 펼치면 스택 오버플로우 발생
    // 청크 단위로 처리하여 변환 (반복문으로 각 바이트를 개별 변환)
    let binaryString = '';
    const chunkSize = 8192; // 8KB씩 처리
    for (let i = 0; i < utf8Bytes.length; i += chunkSize) {
        const chunkEnd = Math.min(i + chunkSize, utf8Bytes.length);
        for (let j = i; j < chunkEnd; j++) {
            binaryString += String.fromCharCode(utf8Bytes[j]);
        }
    }
    const base64String = btoa(binaryString);
    
    // tEXt 청크 데이터 생성 (keyword: "chara", null byte, base64 데이터)
    const keyword = 'chara';
    const textData = new Uint8Array(keyword.length + 1 + base64String.length);
    for (let i = 0; i < keyword.length; i++) {
        textData[i] = keyword.charCodeAt(i);
    }
    textData[keyword.length] = 0; // null byte
    for (let i = 0; i < base64String.length; i++) {
        textData[keyword.length + 1 + i] = base64String.charCodeAt(i);
    }
    
    // 기존 청크 파싱
    const chunks = [];
    let offset = 8; // PNG 시그니처 이후
    
    while (offset < imageBytes.length) {
        const chunk = parseChunk(imageBytes, offset);
        if (!chunk) break;
        
        // 기존 'chara' 또는 'ccv3' tEXt 청크는 제외
        if (chunk.name === 'tEXt') {
            const textDataString = String.fromCharCode(...chunk.data.slice(0, Math.min(10, chunk.data.length)));
            if (textDataString.startsWith('chara\0') || textDataString.startsWith('ccv3\0')) {
                // 제외 - 새로운 청크로 교체
                offset += chunk.totalLength;
                continue;
            }
        }
        
        chunks.push({
            name: chunk.name,
            data: chunk.data,
        });
        
        offset += chunk.totalLength;
        
        // IEND 청크를 만나면 종료
        if (chunk.name === 'IEND') {
            break;
        }
    }
    
    // 새로운 'chara' tEXt 청크를 IEND 전에 추가
    chunks.splice(chunks.length - 1, 0, {
        name: 'tEXt',
        data: textData,
    });
    
    // PNG 파일 재구성
    const pngSignature = new Uint8Array([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
    
    // 전체 크기 계산
    let totalSize = 8; // PNG 시그니처
    for (const chunk of chunks) {
        totalSize += 12 + chunk.data.length; // 길이(4) + 이름(4) + 데이터 + CRC(4)
    }
    
    const output = new Uint8Array(totalSize);
    let outputOffset = 0;
    
    // PNG 시그니처
    for (let i = 0; i < 8; i++) {
        output[outputOffset++] = pngSignature[i];
    }
    
    // 청크 인코딩
    for (const chunk of chunks) {
        const encodedChunk = createChunk(chunk.name, chunk.data);
        for (let i = 0; i < encodedChunk.length; i++) {
            output[outputOffset++] = encodedChunk[i];
        }
    }
    
    return output;
}

/**
 * Blob을 Uint8Array로 변환
 * @param {Blob} blob - Blob 객체
 * @returns {Promise<Uint8Array>} Uint8Array
 */
async function blobToUint8Array(blob) {
    const arrayBuffer = await blob.arrayBuffer();
    return new Uint8Array(arrayBuffer);
}

