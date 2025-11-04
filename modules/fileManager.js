/**
 * 파일 관리 모듈
 * 파일 불러오기/내보내기 처리
 */


class FileManager {
    constructor(callbacks = {}) {
        this.callbacks = callbacks; // refreshPanelUI 등의 콜백
    }

    /**
     * 특정 타입의 파일 불러오기
     * @param {string} type - 불러오기 타입 ('character', 'chat', 'world-info', 'quick-reply', 'persona')
     */
    async importFile(type) {
        const acceptMap = {
            'character': '.png,.json',
            'chat': '.jsonl',
            'world-info': '.json',
            'quick-reply': '.json',
            'persona': '.json',
        };

        const accept = acceptMap[type] || '.json,.jsonl,.png';
        
        // 숨겨진 파일 입력 요소 생성 또는 재사용
        let fileInput = document.getElementById(`import-file-input-${type}`);
        
        if (!fileInput) {
            fileInput = document.createElement('input');
            fileInput.type = 'file';
            fileInput.id = `import-file-input-${type}`;
            fileInput.style.display = 'none';
            fileInput.accept = accept;
            fileInput.multiple = false;
            document.body.appendChild(fileInput);
            
            fileInput.addEventListener('change', async (e) => {
                const file = e.target.files[0];
                if (!file) return;
                
                await this.processImportFile(file, type);
                
                // 입력 초기화
                e.target.value = '';
            });
        }
        
        // 파일 선택 다이얼로그 열기
        fileInput.click();
    }

    /**
     * 정규식 불러오기
     * @param {string} scriptType - 'global' 또는 'character'
     * @param {string|null} characterId - 캐릭터 ID (캐릭터 한정일 경우)
     */
    async importRegex(scriptType = 'global', characterId = null) {
        // 숨겨진 파일 입력 요소 생성 또는 재사용
        let fileInput = document.getElementById(`import-regex-input-${scriptType}`);
        
        if (!fileInput) {
            fileInput = document.createElement('input');
            fileInput.type = 'file';
            fileInput.id = `import-regex-input-${scriptType}`;
            fileInput.style.display = 'none';
            fileInput.accept = '.json';
            fileInput.multiple = true; // 여러 파일 선택 가능
            document.body.appendChild(fileInput);
            
            fileInput.addEventListener('change', async (e) => {
                const files = Array.from(e.target.files);
                if (files.length === 0) return;
                
                // importRegex - 전역 스코프에서 사용 (window 객체를 통해 접근)
                const importRegexFunc = typeof window !== 'undefined' && window.importRegexGlobal ? window.importRegexGlobal : importRegex;
                
                let totalCount = 0;
                let successCount = 0;
                let failCount = 0;
                const errors = [];
                
                // 모든 파일 순회하여 불러오기
                for (const file of files) {
                    try {
                        const result = await importRegexFunc(file, scriptType, characterId);
                        if (result.success) {
                            totalCount += result.count;
                            successCount++;
                        } else {
                            failCount++;
                            errors.push(`${file.name}: ${result.error}`);
                        }
                    } catch (error) {
                        failCount++;
                        errors.push(`${file.name}: ${error.message || error}`);
                    }
                }
                
                // 결과 알림
                let message = '';
                if (successCount > 0) {
                    message = `정규식 불러오기 완료!\n성공: ${successCount}개 파일, ${totalCount}개 스크립트`;
                }
                if (failCount > 0) {
                    message += (message ? '\n\n' : '') + `실패: ${failCount}개 파일`;
                    if (errors.length > 0) {
                        message += '\n' + errors.slice(0, 3).join('\n');
                        if (errors.length > 3) {
                            message += `\n... 외 ${errors.length - 3}개`;
                        }
                    }
                }
                
                if (message) {
                    showToast(message, 'success');
                }
                
                // UI 새로고침 (성공한 파일이 하나라도 있으면)
                if (successCount > 0 && this.callbacks.refreshPanelUI) {
                    this.callbacks.refreshPanelUI('regex');
                }
                
                // 입력 초기화
                e.target.value = '';
            });
        }
        
        // 파일 선택 다이얼로그 열기
        fileInput.click();
    }

    /**
     * 정규식 내보내기
     * @param {string} scriptType - 'global' 또는 'character'
     * @param {string|null} characterId - 캐릭터 ID (캐릭터 한정일 경우)
     * @param {string|null} scriptId - 스크립트 ID (단일 스크립트 내보내기일 경우)
     */
    async exportRegex(scriptType = 'global', characterId = null, scriptId = null) {
        // 전역 함수 exportRegex 호출 (메서드 이름과 충돌 방지)
        // utils/regexImportExport.js의 exportRegex 함수를 window 객체를 통해 호출
        if (typeof window === 'undefined' || typeof window.exportRegexGlobal !== 'function') {
            throw new Error('exportRegexGlobal 함수를 찾을 수 없습니다. utils/regexImportExport.js가 로드되었는지 확인하세요.');
        }
        const result = await window.exportRegexGlobal(scriptType, characterId, scriptId);
        if (result.success) {
            showToast(`정규식 내보내기 성공! 내보낸 스크립트: ${result.count}개`, 'success');
        } else if (result.cancelled) {
            // 취소 시에는 메시지 표시 안 함
        } else {
            showToast(`정규식 내보내기 실패: ${result.error}`, 'error');
        }
    }

    /**
     * 파일 불러오기 처리 (타입 지정)
     * @param {File} file - 불러올 파일
     * @param {string} type - 파일 타입 ('character', 'chat', 'world-info', 'quick-reply', 'persona', 'regex', 'auto')
     */
    async processImportFile(file, type = 'auto') {
        try {
            let result;
            
            if (type === 'auto') {
                // 자동 감지
                result = await autoImport(file);
            } else {
                // 타입별 명시적 불러오기
                switch (type) {
                    case 'character':
                        result = await importCharacter(file);
                        break;
                    case 'chat':
                        result = await importChat(file);
                        break;
                    case 'world-info':
                        result = await importWorldInfo(file);
                        break;
                    case 'quick-reply':
                        result = await importQuickReply(file);
                        break;
            case 'persona':
                result = await importPersona(file);
                break;
            case 'regex':
                result = await importRegex(file);
                break;
            default:
                result = await autoImport(file);
        }
    }
            
            if (result.success) {
                // 성공 메시지
                const typeName = type === 'auto' ? this.getImportTypeName(result) : this.getTypeDisplayName(type);
                
                // 채팅 불러오기인 경우 자동으로 채팅 로드
                if (type === 'chat' && result.chatId && window.chatManager) {
                    // 채팅 관리 모달 닫기
                    if (window.panelManager) {
                        window.panelManager.closePanelModal();
                    }
                    
                    // 캐릭터가 있으면 자동으로 채팅 로드
                    if (result.hasCharacter && result.characterId) {
                        // ⚠️ 중요: 불러온 채팅을 로드할 때는 selectCharacter를 호출하지 않음
                        // 이유: selectCharacter가 loadOrCreateChat을 호출하여 기존 채팅을 저장하는데,
                        // 이 시점에 currentChatId가 null이라 빈 채팅이 저장됨
                        // 대신 캐릭터 선택 상태와 UI만 업데이트하고 직접 loadChat 호출
                        
                        // 캐릭터 선택 상태 및 UI 업데이트 (채팅 저장 없이)
                        if (window.characterManager) {
                            const character = await CharacterStorage.load(result.characterId);
                            if (character) {
                                // 캐릭터 선택 상태 업데이트 (SettingsStorage에 저장)
                                await CharacterStorage.saveCurrent(result.characterId);
                                
                                // UI 업데이트 (selectCharacter의 일부 기능만 수행)
                                const name = character?.data?.name || character?.name || result.characterId;
                                if (window.characterManager.elements && window.characterManager.elements.charName) {
                                    window.characterManager.elements.charName.textContent = name;
                                }
                                
                                // 채팅 목록 버튼 표시
                                if (window.characterManager.elements && window.characterManager.elements.chatListBtn) {
                                    window.characterManager.elements.chatListBtn.classList.remove('hidden');
                                }
                                
                                // 프로필 버튼 표시
                                if (window.characterManager.elements && window.characterManager.elements.profileBtn) {
                                    window.characterManager.elements.profileBtn.classList.remove('hidden');
                                }
                                
                                // 채팅 관리자에 캐릭터 ID 설정 (loadChat에서 필요)
                                window.chatManager.currentCharacterId = result.characterId;
                            }
                        }
                        
                        // 채팅 로드 (불러온 채팅 로드)
                        // ⚠️ 중요: loadChat이 호출되기 전에 currentChatId를 null로 유지하여
                        // 불러온 채팅이 로드되기 전에 saveChat이 호출되어도 빈 채팅이 저장되지 않도록 함
                        await window.chatManager.loadChat(result.chatId);
                        showToast(`채팅 불러오기 완료! 파일: ${file.name}, 메시지: ${result.messageCount}개`, 'success');
                    } else {
                        // 캐릭터가 없으면 알림만 (이미 importChat에서 알림 표시됨)
                        showToast(`채팅 불러오기 완료! 파일: ${file.name}, 메시지: ${result.messageCount}개\n\n캐릭터를 찾을 수 없어 채팅 목록에서만 확인할 수 있습니다.`, 'warning');
                    }
                } else {
                    // 다른 타입은 기존대로
                    showToast(`파일 불러오기 성공! 파일: ${file.name}, 타입: ${typeName}`, 'success');
                }
                
                // UI 새로고침
                if (this.callbacks.refreshPanelUI) {
                    this.callbacks.refreshPanelUI(type);
                }
            } else {
                // 오류 메시지
                // 오류 코드 토스트 알림 표시
                if (typeof showErrorCodeToast === 'function') {
                    showErrorCodeToast('ERR_FILE_6001', '파일 불러오기 오류', new Error(result.error));
                } else if (typeof showToast === 'function') {
                    showToast(`파일 불러오기 실패: ${result.error}`, 'error');
                }
            }
        } catch (error) {
            // 오류 코드 토스트 알림 표시
            if (typeof showErrorCodeToast === 'function') {
                showErrorCodeToast('ERR_FILE_6002', '파일 불러오기 예외', error);
            } else if (typeof showToast === 'function') {
                showToast(`파일 불러오기 중 오류가 발생했습니다: ${error.message}`, 'error');
            }
        }
    }

    /**
     * 타입 표시 이름 가져오기
     * @param {string} type - 타입
     * @returns {string} 표시 이름
     */
    getTypeDisplayName(type) {
        const names = {
            'character': '캐릭터',
            'chat': '채팅',
            'world-info': '월드인포',
            'quick-reply': 'Quick Reply',
            'persona': '페르소나',
        };
        return names[type] || type;
    }

    /**
     * 불러오기 타입 이름 가져오기
     * @param {object} result - 불러오기 결과
     * @returns {string} 타입 이름
     */
    getImportTypeName(result) {
        if (result.characterId) return '캐릭터';
        if (result.chatId) return '채팅';
        if (result.entryCount !== undefined) return '월드인포';
        if (result.setCount !== undefined) return 'Quick Reply';
        if (result.personaId) return '페르소나';
        return '알 수 없음';
    }
}

