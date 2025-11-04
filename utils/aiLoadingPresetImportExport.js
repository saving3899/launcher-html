/**
 * AI 로딩 프리셋 불러오기/내보내기 유틸리티
 */


/**
 * UUID v4 생성
 * @returns {string} UUID v4 문자열
 */
function uuidv4() {
    if ('randomUUID' in crypto) {
        return crypto.randomUUID();
    }
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

/**
 * 파일명 정리 함수
 * @param {string} name - 원본 이름
 * @returns {string} 정리된 파일명
 */
function sanitizeFileName(name) {
    return name.replace(/[<>:"/\\|?*]/g, '_').replace(/\s+/g, '_');
}

/**
 * 프리셋 불러오기
 * @param {File} file - JSON 파일
 * @returns {Promise<object>} 불러오기 결과
 */
async function importAILoadingPreset(file) {
    try {
        // 파일 읽기
        const data = await parseJsonFile(file);
        
        // 배열 또는 객체 모두 처리
        let presetsArray = [];
        if (Array.isArray(data)) {
            presetsArray = data;
        } else if (typeof data === 'object' && data !== null) {
            // 단일 프리셋인 경우 배열로 변환
            presetsArray = [data];
        } else {
            throw new Error('유효하지 않은 프리셋 파일 형식입니다.');
        }

        // 기존 프리셋 로드
        const existingPresets = await AILoadingStorage.loadAllPresets();

        // 각 프리셋 처리
        let importedCount = 0;
        for (const preset of presetsArray) {
            try {
                // name 필수
                if (!preset.name) {
                    // 경고 코드 토스트 알림 표시
                    if (typeof showErrorCodeToast === 'function') {
                        showErrorCodeToast('WARN_FILE_20005', 'AI 로딩 프리셋 이름이 없어 건너뜀');
                    }
                    continue;
                }

                // 새로운 UUID 할당 (기존 ID 무시)
                const newPresetId = uuidv4();
                
                // 프리셋 저장
                await AILoadingStorage.savePreset(newPresetId, {
                    name: preset.name,
                    html: preset.html || '',
                    css: preset.css || ''
                });
                
                importedCount++;
            } catch (error) {
                // 오류 코드 토스트 알림 표시
                if (typeof showErrorCodeToast === 'function') {
                    showErrorCodeToast('ERR_FILE_6011', 'AI 로딩 프리셋 처리 오류', error);
                }
                // 실패한 프리셋은 건너뛰고 계속 진행
            }
        }

        return {
            success: true,
            count: importedCount,
        };
    } catch (error) {
        // 오류 코드 토스트 알림 표시
        if (typeof showErrorCodeToast === 'function') {
            showErrorCodeToast('ERR_FILE_6012', 'AI 로딩 프리셋 불러오기 오류', error);
        }
        return {
            success: false,
            error: error.message || '프리셋 파일을 읽을 수 없습니다.',
        };
    }
}

/**
 * 프리셋 내보내기
 * @param {string|null} presetId - 프리셋 ID (null이면 모든 프리셋 내보내기)
 * @returns {Promise<object>} 내보내기 결과
 */
async function exportAILoadingPreset(presetId = null) {
    try {
        let presetsToExport = [];
        
        if (presetId) {
            // 단일 프리셋 내보내기
            const preset = await AILoadingStorage.loadPreset(presetId);
            if (!preset) {
                return {
                    success: false,
                    error: '프리셋을 찾을 수 없습니다.',
                };
            }
            
            // 내보낼 때는 ID 제거 (불러오기 시 새 ID 생성)
            const { id, created_at, updated_at, ...presetData } = preset;
            presetsToExport = [presetData];
        } else {
            // 모든 프리셋 내보내기
            const allPresets = await AILoadingStorage.loadAllPresets();
            
            // 객체를 배열로 변환하고 ID 제거
            presetsToExport = Object.values(allPresets).map(preset => {
                const { id, created_at, updated_at, ...presetData } = preset;
                return presetData;
            });
        }

        // JSON 문자열 생성
        const jsonString = JSON.stringify(presetsToExport.length === 1 ? presetsToExport[0] : presetsToExport, null, 2);

        // 파일 다운로드
        const blob = new Blob([jsonString], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        
        if (presetId) {
            const preset = await AILoadingStorage.loadPreset(presetId);
            const fileName = preset ? sanitizeFileName(preset.name) + '.json' : 'ai_loading_preset.json';
            a.download = fileName;
        } else {
            a.download = 'ai_loading_presets.json';
        }
        
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        return {
            success: true,
            count: presetsToExport.length,
        };
    } catch (error) {
        // 오류 코드 토스트 알림 표시
        if (typeof showErrorCodeToast === 'function') {
            showErrorCodeToast('ERR_FILE_6013', 'AI 로딩 프리셋 내보내기 오류', error);
        }
        return {
            success: false,
            error: error.message || '프리셋 내보내기에 실패했습니다.',
        };
    }
}

