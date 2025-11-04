/**
 * 캐릭터 내보내기 유틸리티
 * PNG 또는 JSON 형식으로 캐릭터 데이터 내보내기
 * 실리태번과 호환되는 형식으로 내보내기
 */


/**
 * Deep merge utility (lodash deepMerge와 유사)
 * @param {object} target - 대상 객체
 * @param {object} source - 소스 객체
 * @returns {object} 병합된 객체
 */
function deepMerge(target, source) {
    const result = { ...target };
    
    for (const key in source) {
        if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
            result[key] = deepMerge(target[key] || {}, source[key]);
        } else {
            result[key] = source[key];
        }
    }
    
    return result;
}

/**
 * Private 필드 제거 (실리태번의 unsetPrivateFields와 동일)
 * @param {object} char - 캐릭터 객체
 */
function unsetPrivateFields(char) {
    // fav 필드를 false로 설정
    if (char !== null && typeof char === 'object') {
        char.fav = false;
        
        // data.extensions.fav도 false로 설정
        if (char.data && char.data.extensions) {
            char.data.extensions.fav = false;
        }
        
        // chat 필드 제거
        delete char.chat;
    }
}

/**
 * 캐릭터 내보내기
 * @param {string} characterId - 캐릭터 ID
 * @param {string} format - 내보내기 형식 ('png' 또는 'json')
 * @returns {Promise<object>} 내보내기 결과 { success: boolean, blob?: Blob, fileName?: string, error?: string }
 */
async function exportCharacter(characterId, format = 'png') {
    try {
        // 캐릭터 데이터 로드
        const character = await CharacterStorage.load(characterId);
        if (!character) {
            return {
                success: false,
                error: '캐릭터를 찾을 수 없습니다.',
            };
        }

        // 캐릭터 한정 정규식 로드
        const regexScripts = await RegexScriptStorage.loadCharacterRegex(characterId);

        // 캐릭터 데이터 준비 (Chara Card V2 형식)
        const charName = character?.data?.name || character?.name || characterId;
        
        // 파일명에 사용할 수 있는 안전한 이름 생성 (한글 유지, 파일 시스템에서 금지된 문자만 제거)
        const sanitizeFileName = (name) => {
            // Windows/Linux 파일 시스템에서 금지된 문자 제거: < > : " / \ | ? *
            // 공백도 언더스코어로 변경 (선택적, 원하면 제거 가능)
            return name.replace(/[<>:"/\\|?*\x00-\x1F]/g, '').trim() || characterId;
        };
        const safeFileName = sanitizeFileName(charName);
        
        // 기존 캐릭터 데이터를 V2 형식으로 변환
        // character.data가 있으면 그대로 사용, 없으면 기본 구조 생성
        const charaCard = {
            spec: 'chara_card_v2',
            spec_version: '2.0',
            name: charName,
            ...(character.data ? {} : {
                description: character?.description || '',
                personality: character?.personality || '',
                scenario: character?.scenario || '',
                first_mes: character?.first_mes || character?.first_message || '',
                mes_example: character?.mes_example || '',
            }),
            data: {
                ...(character.data || {}),
                // extensions deep merge (실리태번의 charaFormatData와 동일)
                extensions: deepMerge(
                    character.data?.extensions || {},
                    character.extensions || {}
                ),
            },
        };

        // 정규식 스크립트가 있으면 data.extensions.regex_scripts에 추가
        if (Object.keys(regexScripts).length > 0) {
            if (!charaCard.data.extensions) {
                charaCard.data.extensions = {};
            }
            charaCard.data.extensions.regex_scripts = regexScripts;
        }

        // Private 필드 제거 (실리태번과 동일)
        unsetPrivateFields(charaCard);

        if (format === 'png') {
            // PNG 형식으로 내보내기
            const avatarImage = character.avatar_image || character.avatarImage || '';
            
            if (!avatarImage || !avatarImage.startsWith('data:image')) {
                // 아바타 이미지가 없으면 기본 이미지 사용 또는 JSON으로 내보내기 제안
                return {
                    success: false,
                    error: 'PNG 내보내기를 위해서는 캐릭터 아바타 이미지가 필요합니다. JSON 형식으로 내보내시겠습니까?',
                };
            }

            try {
                // JSON 문자열 생성 (실리태번과 동일한 형식)
                const jsonString = JSON.stringify(charaCard);
                
                // PNG에 데이터 임베드
                const pngData = await embedDataInPng(avatarImage, jsonString);
                
                // Blob 생성
                const blob = new Blob([pngData], { type: 'image/png' });
                
                return {
                    success: true,
                    blob: blob,
                    fileName: `${safeFileName}.png`,
                };
            } catch (error) {
                // 오류 코드 토스트 알림 표시
                if (typeof showErrorCodeToast === 'function') {
                    showErrorCodeToast('ERR_FILE_6015', 'PNG 임베드 오류', error);
                }
                return {
                    success: false,
                    error: `PNG 내보내기 실패: ${error.message}`,
                };
            }
        } else if (format === 'json') {
            // JSON 형식으로 내보내기 (실리태번과 동일: 들여쓰기 4칸)
            const jsonString = JSON.stringify(charaCard, null, 4);
            const blob = new Blob([jsonString], { type: 'application/json' });
            
            return {
                success: true,
                blob: blob,
                fileName: `${safeFileName}.json`,
            };
        } else {
            return {
                success: false,
                error: `지원하지 않는 형식입니다: ${format}`,
            };
        }
    } catch (error) {
        // 오류 코드 토스트 알림 표시
        if (typeof showErrorCodeToast === 'function') {
            showErrorCodeToast('ERR_FILE_6016', '캐릭터 내보내기 오류', error);
        }
        return {
            success: false,
            error: error.message || '알 수 없는 오류가 발생했습니다.',
        };
    }
}

/**
 * 파일 다운로드 (Blob) - 저장 위치 선택 가능
 * File System Access API를 사용하여 저장 위치를 선택할 수 있음
 * 지원하지 않는 브라우저에서는 기본 다운로드 폴더에 저장
 * @param {Blob} blob - 다운로드할 Blob
 * @param {string} fileName - 파일명
 * @returns {Promise<boolean>} 성공 시 true, 취소 시 false 반환
 */
async function downloadBlob(blob, fileName) {
    // File System Access API 지원 여부 확인
    if ('showSaveFilePicker' in window) {
        try {
            // 파일 확장자에 따른 MIME 타입 결정
            const fileExtension = fileName.split('.').pop()?.toLowerCase() || '';
            let mimeType = 'application/octet-stream';
            let description = '파일';
            
            if (fileExtension === 'json') {
                mimeType = 'application/json';
                description = 'JSON 파일';
            } else if (fileExtension === 'png') {
                mimeType = 'image/png';
                description = 'PNG 이미지';
            } else if (fileExtension === 'txt' || fileExtension === 'md') {
                mimeType = 'text/plain';
                description = '텍스트 파일';
            }
            
            // 파일 저장 위치 선택 다이얼로그 표시
            const fileHandle = await window.showSaveFilePicker({
                suggestedName: fileName,
                types: [{
                    description: description,
                    accept: {
                        [mimeType]: [`.${fileExtension}`]
                    }
                }]
            });
            
            // 파일 쓰기
            const writable = await fileHandle.createWritable();
            await writable.write(blob);
            await writable.close();
            
            return true; // 성공
        } catch (error) {
            // 사용자가 취소한 경우 (AbortError)
            if (error.name === 'AbortError') {
                return false; // 취소
            }
            // 기타 오류 발생 시 폴백 사용
            // 경고 코드 토스트 알림 표시
            if (typeof showErrorCodeToast === 'function') {
                showErrorCodeToast('WARN_FILE_20008', 'File System Access API 오류, 기본 다운로드 방식으로 폴백');
            }
        }
    }
    
    // File System Access API를 지원하지 않거나 오류 발생 시 기본 다운로드 방식 사용
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    return true; // 기본 다운로드 방식은 항상 성공으로 간주 (취소 불가)
}

// window 객체에 명시적으로 할당 (characterManager.js의 메서드와 이름 충돌 방지)
if (typeof window !== 'undefined') {
    window.exportCharacterUtil = exportCharacter;
    window.downloadBlobUtil = downloadBlob;
}
