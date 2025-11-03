/**
 * 캐릭터 관리 모듈
 * 캐릭터 선택, 프로필, 목록 관리
 */


class CharacterManager {
    constructor(elements, panelManager) {
        this.elements = elements;
        this.panelManager = panelManager;
        
        // 프로필 버튼이 없으면 추가로 찾기
        if (!this.elements.profileBtn) {
            this.elements.profileBtn = document.getElementById('profile-btn');
        }
    }

    /**
     * 캐릭터 목록 패널 열기
     */
    async openCharactersPanel() {
        const panelHtml = await createCharactersPanel();
        this.panelManager.openPanelModal(panelHtml, 'characters');
    }

    /**
     * 캐릭터 선택 및 채팅 열기
     * @param {string} characterId - 캐릭터 ID
     */
    async selectCharacter(characterId) {
        // 기존 캐릭터의 채팅 저장 (캐릭터 변경 시)
        // SettingsStorage - 전역 스코프에서 사용
        const settings = await SettingsStorage.load();
        const previousCharacterId = settings.currentCharacterId;
        
        // 최근 채팅 자동 로드 (ChatManager를 통해)
        // window.chatManager 사용 (app.js에서 전역에 할당됨)
        const chatManager = window.chatManager;
        
        // 이전 캐릭터가 있고 다른 캐릭터로 변경하는 경우
        if (previousCharacterId && previousCharacterId !== characterId && chatManager) {
            // 현재 채팅 저장 (캐릭터 변경 전)
            if (chatManager.currentChatId && chatManager.currentCharacterId === previousCharacterId) {
                try {
                    await chatManager.saveChat();
                } catch (error) {
                    // 오류 코드 토스트 알림 표시
                    if (typeof showErrorCodeToast === 'function') {
                        showErrorCodeToast('ERR_CHAR_4001', '이전 채팅 저장 실패', error);
                    }
                }
            }
            
            // 채팅 영역 완전 초기화 (메시지 제거)
            if (chatManager.elements && chatManager.elements.chatMessages) {
                // 모든 메시지 제거
                chatManager.elements.chatMessages.innerHTML = '';
                // 현재 채팅 상태 초기화
                chatManager.currentChatId = null;
                chatManager.currentChatName = null;
                chatManager.currentCharacterId = null;
                chatManager.chatCreateDate = null;
                
                // DOM 업데이트 대기 (초기화가 완전히 반영되도록)
                await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
            }
            
            // 입력창 초기화
            if (chatManager.elements && chatManager.elements.messageInput) {
                chatManager.elements.messageInput.value = '';
                // 입력창 높이 리셋 (명시적으로 44px로 설정)
                chatManager.elements.messageInput.style.height = '44px';
                // 강제 리플로우로 높이 업데이트 보장
                chatManager.elements.messageInput.offsetHeight;
            }
        }
        
        // 새 캐릭터 선택 및 저장
        await CharacterStorage.saveCurrent(characterId);
        const character = await CharacterStorage.load(characterId);
        
        if (character) {
            const name = character?.data?.name || character?.name || characterId;
            this.elements.charName.textContent = name;
            
            // 채팅 목록 버튼 표시
            if (this.elements.chatListBtn) {
                this.elements.chatListBtn.classList.remove('hidden');
            }
            
            // 프로필 버튼 표시
            if (this.elements.profileBtn) {
                this.elements.profileBtn.classList.remove('hidden');
            }
            
            // 새 캐릭터의 채팅 로드 또는 생성
            if (chatManager) {
                // 같은 캐릭터를 다시 선택하는 경우 처리
                // chatManager.currentCharacterId를 우선 확인 (더 정확함)
                const isSameCharacter = chatManager.currentCharacterId === characterId || previousCharacterId === characterId;
                
                if (isSameCharacter) {
                    // 이미 같은 캐릭터의 채팅이 로드되어 있는지 확인
                    if (chatManager.currentCharacterId === characterId && chatManager.currentChatId) {
                        // 같은 캐릭터의 채팅이 이미 로드되어 있으면 그대로 사용
                        // (채팅 로드 또는 생성 스킵)
                        return;
                    }
                    // 같은 캐릭터이지만 채팅이 로드되지 않은 경우는 계속 진행
                    // (경고 없이 채팅 로드 또는 생성)
                } else {
                    // 다른 캐릭터로 변경하는 경우: 채팅 영역이 비어있어야 함
                    // (이미 위에서 초기화했지만, 혹시 남아있으면 다시 확인)
                if (chatManager.elements && chatManager.elements.chatMessages) {
                    if (chatManager.elements.chatMessages.children.length > 0) {
                            // 다른 캐릭터로 변경 시 남아있는 메시지 정리 (정상적인 흐름)
                            // 디버깅 정보는 콘솔에만 기록 (토스트 제거)
                            console.debug('[CharacterManager] 다른 캐릭터 선택 시 채팅 메시지 정리');
                        chatManager.elements.chatMessages.innerHTML = '';
                        await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
                        }
                    }
                }
                
                // 채팅 로드 또는 생성
                await chatManager.loadOrCreateChat(characterId);
                
                // DOM 업데이트 대기 (채팅 로드 완료 후, 한 번만)
                await new Promise(resolve => requestAnimationFrame(resolve));
                
                // 인풋창 높이 리셋 (채팅 로드 후에도 비어있을 수 있으므로)
                if (chatManager.elements && chatManager.elements.messageInput) {
                    const inputValue = chatManager.elements.messageInput.value.trim();
                    if (!inputValue) {
                        // 인풋창이 비어있으면 높이 리셋
                        chatManager.elements.messageInput.style.height = '44px';
                        chatManager.elements.messageInput.offsetHeight;
                    }
                }
            } else {
                // 경고 코드 토스트 알림 표시
                if (typeof showErrorCodeToast === 'function') {
                    showErrorCodeToast('WARN_CHAR_20002', 'chatManager를 찾을 수 없음 (폴백 사용)');
                }
                // 폴백: 기존 방식 사용
                await this.loadRecentChat(characterId);
            }
            
            this.panelManager.closePanelModal();
        }
    }

    /**
     * 현재 선택된 캐릭터 ID 가져오기
     * @returns {Promise<string|null>} 캐릭터 ID 또는 null
     */
    async getCurrentCharacterId() {
        return await CharacterStorage.loadCurrent();
    }

    /**
     * 최근 채팅 로드
     * @param {string} characterId - 캐릭터 ID
     */
    async loadRecentChat(characterId) {
        const character = await CharacterStorage.load(characterId);
        if (!character) return;

        const characterName = character?.data?.name || character?.name || 'Unknown';
        
        // 해당 캐릭터와의 채팅 찾기
        const allChats = await ChatStorage.loadAll();
        const filteredChats = Object.entries(allChats).filter(([id, chat]) => {
            return chat?.character_name === characterName || chat?.metadata?.character_name === characterName;
        });

        if (filteredChats.length > 0) {
            // 최근 채팅 선택 (첫 번째)
            const [chatId] = filteredChats[0];
            await ChatStorage.saveCurrent(chatId);
            
            // 채팅 메시지 로드 및 표시 (window.chatManager 사용)
            if (window.chatManager) {
                await window.chatManager.loadChat(chatId);
            } else {
                // 경고 코드 토스트 알림 표시
                if (typeof showErrorCodeToast === 'function') {
                    showErrorCodeToast('WARN_CHAR_20003', 'chatManager를 사용할 수 없음 (loadRecentChat)');
                }
            }
        } else {
            // 새 채팅 시작
            // clearChat()에서 이미 그리팅을 추가하므로 여기서는 호출만 함
            if (this.onClearChat) {
                await this.onClearChat();
            }
        }
    }

    /**
     * 채팅 목록 패널 열기 (현재 캐릭터의 채팅 목록)
     */
    async openChatListPanel() {
        const currentCharId = await CharacterStorage.loadCurrent();
        if (!currentCharId) {
            showToast('먼저 캐릭터를 선택해주세요.', 'warning');
            return;
        }
        
        const panelHtml = await createChatListPanel(currentCharId);
        this.panelManager.openPanelModal(panelHtml, 'chat-list');
    }

    /**
     * 캐릭터 프로필 페이지 열기
     * @param {string} characterId - 캐릭터 ID
     */
    async openCharacterProfile(characterId) {
        const panelHtml = await createCharacterProfilePanel(characterId);
        // 기존 패널이 있고 캐릭터 목록 패널이면 내용만 교체 (패널 닫지 않음)
        const existingPanel = document.getElementById('panel-modal-container');
        // 캐릭터 목록 패널 확인: characters-panel 클래스 또는 #character-import-btn 같은 고유 요소 확인
        const isCharactersPanel = existingPanel && (
            existingPanel.querySelector('.characters-panel') ||
            existingPanel.querySelector('#character-import-btn') ||
            existingPanel.querySelector('[data-panel-type="characters"]')
        );
        
        if (isCharactersPanel) {
            // 패널 내용만 교체 (애니메이션 적용)
            existingPanel.classList.add('closing');
            existingPanel.style.pointerEvents = 'none';
            
            await new Promise(resolve => {
                const handleAnimationEnd = () => {
                    existingPanel.removeEventListener('animationend', handleAnimationEnd);
                    resolve();
                };
                existingPanel.addEventListener('animationend', handleAnimationEnd);
                setTimeout(() => {
                    existingPanel.removeEventListener('animationend', handleAnimationEnd);
                    resolve();
                }, 300); // 타임아웃
            });
            
            // 내용 교체
            existingPanel.classList.remove('closing');
            existingPanel.innerHTML = panelHtml;
            existingPanel.style.opacity = '0';
            existingPanel.style.transform = 'translateY(20px) scale(0.95)';
            existingPanel.style.pointerEvents = '';
            
            // 이전 패널 타입 저장 (캐릭터 관리 모달에서 열었음을 표시)
            existingPanel.dataset.previousPanelType = 'characters';
            
            // 이벤트 리스너 재설정
            this.panelManager.setupCharacterProfileEvents(existingPanel);
            
            // 패널 클릭 핸들러 재설정
            this.panelManager.setupPanelClickHandler(existingPanel);
            
            // 애니메이션 시작 - 약간의 지연을 두어 DOM이 완전히 준비되도록 함
            await new Promise(resolve => {
                requestAnimationFrame(() => {
                    requestAnimationFrame(() => {
                        resolve();
                    });
                });
            });
            
            // opacity와 transform을 명시적으로 설정
            existingPanel.style.transition = 'all var(--transition-normal)';
            existingPanel.style.opacity = '1';
            existingPanel.style.transform = 'translateY(0) scale(1)';
            existingPanel.style.visibility = 'visible';
        } else {
            // 기존 패널이 없거나 다른 패널이면 새로 열기
            // 이전 패널 타입 없음 (직접 열었음)
            this.panelManager.openPanelModal(panelHtml, 'character-profile');
            const panelContainer = document.getElementById('panel-modal-container');
            if (panelContainer) {
                panelContainer.dataset.previousPanelType = ''; // 빈 문자열로 설정하여 직접 열었음을 표시
            }
        }
    }

    /**
     * 캐릭터 액션 처리
     * @param {string} action - 액션 타입 (select, edit, export, delete)
     * @param {string} id - 캐릭터 ID
     */
    async handleCharacterAction(action, id) {
        switch (action) {
            case 'select':
                await this.selectCharacter(id);
                break;
            case 'edit':
                await this.openCharacterProfile(id);
                break;
            case 'export':
                await this.exportCharacter(id);
                break;
            case 'delete':
                const deleteResult = await this.showDeleteCharacterDialog(id);
                if (deleteResult && deleteResult.confirmed) {
                    // 캐릭터 삭제
                    await CharacterStorage.delete(id);
                    
                    // 채팅 파일도 삭제할 경우
                    if (deleteResult.deleteChats) {
                        await this.deleteCharacterChats(id);
                    }
                    
                    showToast('캐릭터가 삭제되었습니다.', 'success');
                    await this.openCharactersPanel(); // 목록 새로고침
                }
                break;
        }
    }

    /**
     * 캐릭터 프로필 저장
     * @param {HTMLFormElement} form - 폼 요소
     */
    async saveCharacterProfile(form) {
        const characterId = form.dataset.characterId;
        if (!characterId) return;

        const character = await CharacterStorage.load(characterId);
        if (!character) return;

        // 폼 데이터 읽기
        const name = document.getElementById('char-name-input').value.trim();
        const description = document.getElementById('char-description').value.trim();
        const personality = document.getElementById('char-personality').value.trim();
        const scenario = document.getElementById('char-scenario').value.trim();
        // 그리팅은 별도 모달에서 편집하므로 여기서는 저장하지 않음
        const firstMessage = character.data?.first_mes || character.first_mes || '';
        const creatorNotes = document.getElementById('char-creator-notes').value.trim();
        const systemPrompt = document.getElementById('char-system-prompt').value.trim();
        const postHistoryInstructions = document.getElementById('char-post-history').value.trim();
        const characterVersion = document.getElementById('char-version').value.trim();
        const creator = document.getElementById('char-creator').value.trim();
        const tagsStr = document.getElementById('char-tags').value.trim();
        const tags = tagsStr ? tagsStr.split(',').map(t => t.trim()).filter(t => t) : [];
        
        // 프로필 이미지 가져오기
        const profileImage = document.getElementById('char-profile-image');
        let avatarImage = '';
        // placeholder가 아니고 img 태그이며 data:image로 시작하는 경우에만 저장
        if (profileImage && profileImage.tagName === 'IMG' && profileImage.src && profileImage.src.startsWith('data:image')) {
            avatarImage = profileImage.src;
        } else if (profileImage && profileImage.classList && profileImage.classList.contains('profile-image-placeholder')) {
            // placeholder인 경우 빈 문자열 (아바타 삭제)
            avatarImage = '';
        }

        // 데이터 구조 업데이트
        const updatedCharacter = {
            ...character,
            name: name,
            avatar_image: avatarImage,
            avatarImage: avatarImage,
            data: {
                ...(character.data || {}),
                name: name,
                description: description,
                personality: personality,
                scenario: scenario,
                first_mes: firstMessage,
                first_message: firstMessage,
                creator_notes: creatorNotes,
                system_prompt: systemPrompt,
                post_history_instructions: postHistoryInstructions,
                character_version: characterVersion,
                creator: creator,
                tags: tags,
                avatar_image: avatarImage,
            },
            description: description,
            personality: personality,
            scenario: scenario,
            first_mes: firstMessage,
            creator_notes: creatorNotes,
        };

        // 저장
        await CharacterStorage.save(characterId, updatedCharacter);

        // UI 업데이트
        const currentCharId = await CharacterStorage.loadCurrent();
        if (currentCharId === characterId) {
            this.elements.charName.textContent = name;
            
            // 현재 채팅이 열려있으면 모든 메시지의 아바타 업데이트
            if (window.chatManager && window.chatManager.currentCharacterId === characterId) {
                await window.chatManager.updateAllMessageAvatars();
            }
        }

        showToast('캐릭터가 저장되었습니다.', 'success');
        
        // 캐릭터 목록 패널로 되돌리기 (애니메이션 적용)
        const panelContainer = document.getElementById('panel-modal-container');
        if (panelContainer) {
            // 전환 시작
            this.panelManager.isTransitioning = true;
            
            panelContainer.classList.add('closing');
            panelContainer.style.pointerEvents = 'none';
            
            await new Promise(resolve => {
                const handleAnimationEnd = () => {
                    panelContainer.removeEventListener('animationend', handleAnimationEnd);
                    resolve();
                };
                panelContainer.addEventListener('animationend', handleAnimationEnd);
                setTimeout(() => {
                    panelContainer.removeEventListener('animationend', handleAnimationEnd);
                    resolve();
                }, 300); // 타임아웃
            });
            
            const charactersHtml = await createCharactersPanel();
            panelContainer.classList.remove('closing');
            panelContainer.innerHTML = charactersHtml;
            panelContainer.style.opacity = '0';
            panelContainer.style.transform = 'translateY(20px) scale(0.95)';
            panelContainer.style.pointerEvents = '';
            panelContainer.classList.remove('hidden'); // hidden 클래스 제거 보장
            
            // DOM이 완전히 렌더링될 때까지 대기
            await new Promise(resolve => {
                requestAnimationFrame(() => {
                    requestAnimationFrame(() => {
                        resolve();
                    });
                });
            });
            
            this.panelManager.setupCharacterPanelEvents(panelContainer);
            this.panelManager.setupPanelClickHandler(panelContainer);
            
            const listCloseBtn = panelContainer.querySelector('.close-panel-btn');
            if (listCloseBtn) {
                listCloseBtn.addEventListener('click', () => this.panelManager.closePanelModal());
            }
            
            // 애니메이션 시작 - 약간의 지연을 두어 DOM이 완전히 준비되도록 함
            await new Promise(resolve => {
                requestAnimationFrame(() => {
                    requestAnimationFrame(() => {
                        resolve();
                    });
                });
            });
            
            // opacity와 transform을 명시적으로 설정
            panelContainer.style.transition = 'all var(--transition-normal)';
            panelContainer.style.opacity = '1';
            panelContainer.style.transform = 'translateY(0) scale(1)';
            panelContainer.style.visibility = 'visible';
            panelContainer.style.display = ''; // display 초기화
            
            // 전환 완료
            this.panelManager.isTransitioning = false;
        } else {
            this.panelManager.closePanelModal();
        }
    }

    /**
     * 내보내기 형식 선택 다이얼로그
     * @returns {Promise<string|null>} 선택된 형식 ('png', 'json') 또는 null (취소)
     */
    showExportFormatDialog() {
        return new Promise((resolve) => {
            // 다이얼로그 컨테이너 생성
            const dialog = document.createElement('div');
            dialog.className = 'export-format-dialog';
            dialog.style.cssText = `
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background: rgba(0, 0, 0, 0.5);
                backdrop-filter: blur(4px);
                display: flex;
                align-items: center;
                justify-content: center;
                z-index: 10000;
                opacity: 0;
                pointer-events: auto;
            `;
            
            const content = document.createElement('div');
            content.className = 'export-format-content';
            content.style.cssText = `
                background: var(--bg-secondary);
                border-radius: var(--border-radius-lg);
                padding: var(--spacing-xl);
                max-width: 400px;
                width: 90%;
                box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
            `;
            
            const title = document.createElement('h3');
            title.textContent = '내보내기 형식 선택';
            title.style.cssText = `
                margin: 0 0 var(--spacing-md) 0;
                color: var(--text-primary);
                font-size: 18px;
            `;
            
            const message = document.createElement('p');
            message.textContent = '캐릭터를 어떤 형식으로 내보내시겠습니까?';
            message.style.cssText = `
                margin: 0 0 var(--spacing-lg) 0;
                color: var(--text-secondary);
                font-size: 14px;
            `;
            
            const buttonContainer = document.createElement('div');
            buttonContainer.style.cssText = `
                display: flex;
                gap: var(--spacing-md);
                justify-content: flex-end;
            `;
            
            const cancelBtn = document.createElement('button');
            cancelBtn.textContent = '취소';
            cancelBtn.style.cssText = `
                padding: var(--spacing-sm) var(--spacing-lg);
                background: rgba(255, 255, 255, 0.1);
                border: 1px solid rgba(255, 255, 255, 0.15);
                border-radius: var(--border-radius-sm);
                color: var(--text-secondary);
                font-size: 14px;
                font-weight: 500;
                cursor: pointer;
                transition: all var(--transition-fast);
            `;
            cancelBtn.addEventListener('mouseenter', () => {
                cancelBtn.style.background = 'rgba(255, 255, 255, 0.15)';
                cancelBtn.style.color = 'var(--text-primary)';
            });
            cancelBtn.addEventListener('mouseleave', () => {
                cancelBtn.style.background = 'rgba(255, 255, 255, 0.1)';
                cancelBtn.style.color = 'var(--text-secondary)';
            });
            cancelBtn.addEventListener('click', () => {
                this.closeExportFormatDialog(dialog, resolve, null);
            });
            
            const pngBtn = document.createElement('button');
            pngBtn.textContent = 'PNG 형식';
            pngBtn.style.cssText = `
                padding: var(--spacing-sm) var(--spacing-lg);
                background: #2196F3;
                border: none;
                border-radius: var(--border-radius-sm);
                color: #ffffff;
                font-size: 14px;
                font-weight: 500;
                cursor: pointer;
                transition: all var(--transition-fast);
                box-shadow: 0 2px 8px rgba(33, 150, 243, 0.3);
            `;
            pngBtn.addEventListener('mouseenter', () => {
                pngBtn.style.background = '#42a5f5';
                pngBtn.style.transform = 'translateY(-1px)';
                pngBtn.style.boxShadow = '0 4px 12px rgba(33, 150, 243, 0.4)';
            });
            pngBtn.addEventListener('mouseleave', () => {
                pngBtn.style.background = '#2196F3';
                pngBtn.style.transform = 'translateY(0)';
                pngBtn.style.boxShadow = '0 2px 8px rgba(33, 150, 243, 0.3)';
            });
            pngBtn.addEventListener('click', () => {
                this.closeExportFormatDialog(dialog, resolve, 'png');
            });
            
            const jsonBtn = document.createElement('button');
            jsonBtn.textContent = 'JSON 형식';
            jsonBtn.style.cssText = `
                padding: var(--spacing-sm) var(--spacing-lg);
                background: var(--accent-green);
                border: none;
                border-radius: var(--border-radius-sm);
                color: #ffffff;
                font-size: 14px;
                font-weight: 500;
                cursor: pointer;
                transition: all var(--transition-fast);
                box-shadow: 0 2px 8px rgba(76, 175, 80, 0.3);
            `;
            jsonBtn.addEventListener('mouseenter', () => {
                jsonBtn.style.background = '#66bb6a';
                jsonBtn.style.transform = 'translateY(-1px)';
                jsonBtn.style.boxShadow = '0 4px 12px rgba(76, 175, 80, 0.4)';
            });
            jsonBtn.addEventListener('mouseleave', () => {
                jsonBtn.style.background = 'var(--accent-green)';
                jsonBtn.style.transform = 'translateY(0)';
                jsonBtn.style.boxShadow = '0 2px 8px rgba(76, 175, 80, 0.3)';
            });
            jsonBtn.addEventListener('click', () => {
                this.closeExportFormatDialog(dialog, resolve, 'json');
            });
            
            buttonContainer.appendChild(cancelBtn);
            buttonContainer.appendChild(pngBtn);
            buttonContainer.appendChild(jsonBtn);
            
            content.appendChild(title);
            content.appendChild(message);
            content.appendChild(buttonContainer);
            dialog.appendChild(content);
            
            // 배경 클릭 시 취소
            const handleBackgroundClick = (e) => {
                if (content.contains(e.target)) {
                    return;
                }
                if (e.target === dialog) {
                    this.closeExportFormatDialog(dialog, resolve, null);
                }
            };
            
            dialog.addEventListener('click', handleBackgroundClick);
            
            document.body.appendChild(dialog);
            
            // 애니메이션 트리거
            requestAnimationFrame(() => {
                dialog.style.transition = 'opacity 0.2s ease';
                dialog.style.opacity = '1';
            });
        });
    }
    
    /**
     * 내보내기 형식 선택 다이얼로그 닫기
     * @param {HTMLElement} dialog - 다이얼로그 요소
     * @param {Function} resolve - Promise resolve 함수
     * @param {string|null} format - 선택된 형식 또는 null
     */
    closeExportFormatDialog(dialog, resolve, format) {
        dialog.style.transition = 'opacity 0.2s ease';
        dialog.style.opacity = '0';
        setTimeout(() => {
            if (dialog.parentNode) {
                dialog.parentNode.removeChild(dialog);
            }
            resolve(format);
        }, 200);
    }

    /**
     * 캐릭터 내보내기
     * @param {string} characterId - 캐릭터 ID
     */
    async exportCharacter(characterId) {
        // 형식 선택 다이얼로그 표시
        const format = await this.showExportFormatDialog();
        
        // 취소된 경우 종료
        if (!format) {
            return;
        }
        
        // exportCharacter - 전역 스코프에서 사용 (utils/export.js)
        // 메서드 이름과 충돌 방지를 위해 window 객체를 통해 호출
        if (typeof window === 'undefined' || typeof window.exportCharacterUtil !== 'function') {
            throw new Error('exportCharacterUtil 함수를 찾을 수 없습니다. utils/export.js가 로드되었는지 확인하세요.');
        }
        const result = await window.exportCharacterUtil(characterId, format);
        
        if (result.success && result.blob && result.fileName) {
            const downloadBlobFunc = typeof window !== 'undefined' && window.downloadBlobUtil ? window.downloadBlobUtil : downloadBlob;
            const downloadSuccess = await downloadBlobFunc(result.blob, result.fileName);
            if (downloadSuccess) {
                showToast(`캐릭터 내보내기 성공! 파일명: ${result.fileName}`, 'success');
            }
            // 취소 시에는 메시지 표시 안 함
        } else {
            // PNG 내보내기 실패 시 JSON으로 재시도 제안
            if (format === 'png' && result.error && result.error.includes('아바타 이미지')) {
                const tryJson = await showConfirmModal(`${result.error}\n\nJSON 형식으로 내보내시겠습니까?`, '내보내기 형식 변경');
                if (tryJson) {
                    // exportCharacter - 전역 스코프에서 사용 (utils/export.js)
                    const jsonResult = await window.exportCharacterUtil(characterId, 'json');
                    if (jsonResult.success && jsonResult.blob && jsonResult.fileName) {
                        const downloadBlobFunc = typeof window !== 'undefined' && window.downloadBlobUtil ? window.downloadBlobUtil : downloadBlob;
                        const downloadSuccess = await downloadBlobFunc(jsonResult.blob, jsonResult.fileName);
                        if (downloadSuccess) {
                            showToast(`캐릭터 내보내기 성공! 파일명: ${jsonResult.fileName}`, 'success');
                        }
                        // 취소 시에는 메시지 표시 안 함
                    } else {
                        showToast(`캐릭터 내보내기 실패: ${jsonResult.error}`, 'error');
                    }
                }
            } else {
                showToast(`캐릭터 내보내기 실패: ${result.error}`, 'error');
            }
        }
    }

    /**
     * 캐릭터 삭제 확인 다이얼로그
     * @param {string} characterId - 삭제할 캐릭터 ID
     * @returns {Promise<{confirmed: boolean, deleteChats: boolean}>} 확인 결과
     */
    showDeleteCharacterDialog(characterId) {
        return new Promise((resolve) => {
            // 다이얼로그 컨테이너 생성
            const dialog = document.createElement('div');
            dialog.className = 'delete-character-dialog';
            dialog.style.cssText = `
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background: rgba(0, 0, 0, 0.5);
                backdrop-filter: blur(4px);
                display: flex;
                align-items: center;
                justify-content: center;
                z-index: 10000;
                opacity: 0;
                pointer-events: auto;
            `;
            
            const content = document.createElement('div');
            content.className = 'delete-character-content';
            content.style.cssText = `
                background: var(--bg-secondary);
                border-radius: var(--border-radius-lg);
                padding: var(--spacing-xl);
                max-width: 400px;
                width: 90%;
                box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
            `;
            
            const title = document.createElement('h3');
            title.textContent = '캐릭터를 삭제하시겠습니까?';
            title.style.cssText = `
                margin: 0 0 var(--spacing-md) 0;
                color: var(--text-primary);
                font-size: 18px;
                font-weight: 600;
            `;
            
            const warning = document.createElement('p');
            warning.textContent = '이 작업은 되돌릴 수 없습니다!';
            warning.style.cssText = `
                margin: 0 0 var(--spacing-lg) 0;
                color: var(--accent-red);
                font-size: 14px;
                font-weight: 500;
            `;
            
            // 체크박스 컨테이너
            const checkboxContainer = document.createElement('div');
            checkboxContainer.style.cssText = `
                display: flex;
                align-items: center;
                gap: var(--spacing-sm);
                margin-bottom: var(--spacing-lg);
                padding: var(--spacing-md);
                background: var(--bg-tertiary);
                border-radius: var(--border-radius);
                cursor: pointer;
            `;
            
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.id = 'delete-chats-checkbox';
            checkbox.style.cssText = `
                width: 18px;
                height: 18px;
                cursor: pointer;
            `;
            
            const checkboxLabel = document.createElement('label');
            checkboxLabel.htmlFor = 'delete-chats-checkbox';
            checkboxLabel.textContent = '채팅 파일도 함께 삭제';
            checkboxLabel.style.cssText = `
                flex: 1;
                color: var(--text-primary);
                font-size: 14px;
                cursor: pointer;
                user-select: none;
            `;
            
            checkboxContainer.appendChild(checkbox);
            checkboxContainer.appendChild(checkboxLabel);
            
            // 체크박스 컨테이너 배경 클릭 시 체크박스 토글
            // label의 htmlFor로 인해 label 클릭은 자동으로 처리되므로 label과 checkbox 클릭은 무시
            checkboxContainer.addEventListener('click', (e) => {
                // checkbox나 label이 아닌 컨테이너 배경 영역을 클릭한 경우에만 토글
                if (e.target === checkboxContainer) {
                    e.preventDefault();
                    checkbox.checked = !checkbox.checked;
                }
                // label이나 checkbox 클릭은 브라우저 기본 동작(htmlFor) 사용
            });
            
            const buttonContainer = document.createElement('div');
            buttonContainer.style.cssText = `
                display: flex;
                gap: var(--spacing-md);
                justify-content: flex-end;
            `;
            
            const cancelBtn = document.createElement('button');
            cancelBtn.textContent = '아니요';
            cancelBtn.style.cssText = `
                padding: var(--spacing-sm) var(--spacing-lg);
                background: rgba(255, 255, 255, 0.1);
                border: 1px solid rgba(255, 255, 255, 0.15);
                border-radius: var(--border-radius-sm);
                color: var(--text-secondary);
                font-size: 14px;
                font-weight: 500;
                cursor: pointer;
                transition: all var(--transition-fast);
            `;
            cancelBtn.addEventListener('mouseenter', () => {
                cancelBtn.style.background = 'rgba(255, 255, 255, 0.15)';
                cancelBtn.style.color = 'var(--text-primary)';
            });
            cancelBtn.addEventListener('mouseleave', () => {
                cancelBtn.style.background = 'rgba(255, 255, 255, 0.1)';
                cancelBtn.style.color = 'var(--text-secondary)';
            });
            cancelBtn.addEventListener('click', () => {
                this.closeDeleteCharacterDialog(dialog, resolve, false, false);
            });
            
            const confirmBtn = document.createElement('button');
            confirmBtn.textContent = '네';
            confirmBtn.style.cssText = `
                padding: var(--spacing-sm) var(--spacing-lg);
                background: rgba(239, 68, 68, 0.15);
                border: 1px solid rgba(239, 68, 68, 0.3);
                border-radius: var(--border-radius-sm);
                color: #f87171;
                font-size: 14px;
                font-weight: 500;
                cursor: pointer;
                transition: all var(--transition-fast);
            `;
            confirmBtn.addEventListener('mouseenter', () => {
                confirmBtn.style.background = 'rgba(239, 68, 68, 0.25)';
                confirmBtn.style.color = '#fca5a5';
            });
            confirmBtn.addEventListener('mouseleave', () => {
                confirmBtn.style.background = 'rgba(239, 68, 68, 0.15)';
                confirmBtn.style.color = '#f87171';
            });
            confirmBtn.addEventListener('click', () => {
                const deleteChats = checkbox.checked;
                this.closeDeleteCharacterDialog(dialog, resolve, true, deleteChats);
            });
            
            buttonContainer.appendChild(cancelBtn);
            buttonContainer.appendChild(confirmBtn);
            
            content.appendChild(title);
            content.appendChild(warning);
            content.appendChild(checkboxContainer);
            content.appendChild(buttonContainer);
            dialog.appendChild(content);
            
            // 배경 클릭 시 취소
            const handleBackgroundClick = (e) => {
                if (content.contains(e.target)) {
                    return;
                }
                if (e.target === dialog) {
                    this.closeDeleteCharacterDialog(dialog, resolve, false, false);
                }
            };
            
            dialog.addEventListener('click', handleBackgroundClick);
            
            document.body.appendChild(dialog);
            
            // 애니메이션 트리거
            requestAnimationFrame(() => {
                dialog.style.transition = 'opacity 0.2s ease';
                dialog.style.opacity = '1';
            });
        });
    }
    
    /**
     * 캐릭터 삭제 다이얼로그 닫기
     * @param {HTMLElement} dialog - 다이얼로그 요소
     * @param {Function} resolve - Promise resolve 함수
     * @param {boolean} confirmed - 확인 여부
     * @param {boolean} deleteChats - 채팅 파일 삭제 여부
     */
    closeDeleteCharacterDialog(dialog, resolve, confirmed, deleteChats) {
        dialog.style.transition = 'opacity 0.2s ease';
        dialog.style.opacity = '0';
        setTimeout(() => {
            if (dialog.parentNode) {
                dialog.parentNode.removeChild(dialog);
            }
            resolve({ confirmed, deleteChats });
        }, 200);
    }
    
    /**
     * 특정 캐릭터의 모든 채팅 파일 삭제
     * @param {string} characterId - 캐릭터 ID
     */
    async deleteCharacterChats(characterId) {
        try {
            const allChats = await ChatStorage.loadAll();
            let deletedCount = 0;
            
            // 해당 캐릭터의 모든 채팅 찾아서 삭제
            for (const [chatId, chatData] of Object.entries(allChats)) {
                if (chatData && chatData.characterId === characterId) {
                    await ChatStorage.delete(chatId);
                    deletedCount++;
                }
            }
        } catch (error) {
            // 오류 코드 토스트 알림 표시
            if (typeof showErrorCodeToast === 'function') {
                showErrorCodeToast('ERR_CHAR_4002', '채팅 파일 삭제 중 오류', error);
            }
            throw error;
        }
    }
}

