/**
 * 패널 관리 모듈
 * 패널 모달 열기/닫기, 패널 이벤트 설정
 */


class PanelManager {
    constructor(elements, callbacks = {}) {
        this.elements = elements;
        this.callbacks = callbacks; // 외부 콜백 함수들 (importFile, selectCharacter 등)
        this.isTransitioning = false; // 패널 전환 중인지 추적
        this.setupOverlay();
    }

    /**
     * 패널 클릭 핸들러 설정 (재사용 가능)
     */
    setupPanelClickHandler(panelContainer) {
        // 기존 클릭 핸들러 제거 (data 속성으로 표시된 핸들러)
        if (panelContainer._panelClickHandler) {
            panelContainer.removeEventListener('click', panelContainer._panelClickHandler);
        }
        
        // 새 클릭 핸들러 생성
        const clickHandler = async (e) => {
            // 모달 컨텐츠 클릭은 무시
            if (e.target.closest('.modal-content')) {
                return;
            }
            
            // 패널이 전환 중이거나 closing 애니메이션 중이거나 opacity가 0이면 무시
            if (this.isTransitioning ||
                panelContainer.classList.contains('closing') || 
                panelContainer.style.opacity === '0' || 
                getComputedStyle(panelContainer).opacity === '0') {
                return;
            }
            
            // 프롬프트 팝업이 열려있으면 닫지 않음
            const promptPopup = document.getElementById('completion_prompt_manager_popup');
            if (promptPopup && promptPopup.style.display !== 'none' && !promptPopup.classList.contains('hidden')) {
                return;
            }
            
            // 캐릭터 편집 모달인지 확인
            const isCharacterProfile = panelContainer.querySelector('#character-profile-form');
            if (isCharacterProfile) {
                // 이전 패널 타입 확인 (캐릭터 관리 모달에서 열었는지)
                const previousPanelType = panelContainer.dataset.previousPanelType;
                
                if (previousPanelType === 'characters') {
                    // 캐릭터 관리 모달에서 열었으면 그곳으로 돌아가기
                    // 전환 시작
                    this.isTransitioning = true;
                    
                    // 캐릭터 목록 패널로 되돌리기 (애니메이션 적용)
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
                    
                    // 이전 패널 타입 제거 (다시 설정하지 않음)
                    delete panelContainer.dataset.previousPanelType;
                    
                    // DOM이 완전히 렌더링될 때까지 대기
                    await new Promise(resolve => {
                        requestAnimationFrame(() => {
                            requestAnimationFrame(() => {
                                resolve();
                            });
                        });
                    });
                    
                    this.setupCharacterPanelEvents(panelContainer);
                    this.setupPanelClickHandler(panelContainer);
                    
                    const listCloseBtn = panelContainer.querySelector('.close-panel-btn');
                    if (listCloseBtn) {
                        listCloseBtn.addEventListener('click', () => this.closePanelModal());
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
                    this.isTransitioning = false;
                    return;
                } else {
                    // 직접 열었으면 (plus-menu나 char-info-profile에서) 완전히 닫기
                    // 계속 진행하여 일반 닫기 로직 실행
                }
            }
            
            // 페르소나 편집 모달인지 확인
            const isPersonaEditor = panelContainer.querySelector('#persona-editor-form');
            if (isPersonaEditor) {
                // 전환 시작
                this.isTransitioning = true;
                
                // 페르소나 목록 패널로 되돌리기 (애니메이션 적용)
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
                
                const newPanelHtml = await createPersonaPanel();
                panelContainer.classList.remove('closing');
                panelContainer.innerHTML = newPanelHtml;
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
                
                this.setupPersonaPanelEvents(panelContainer);
                this.setupPanelClickHandler(panelContainer);
                
                const closeBtn = panelContainer.querySelector('.close-panel-btn');
                if (closeBtn) {
                    closeBtn.addEventListener('click', () => this.closePanelModal());
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
                this.isTransitioning = false;
                return;
            }
            
            // 정규식 편집 모달인지 확인
            const isRegexEditor = panelContainer.querySelector('#regex-editor-save');
            if (isRegexEditor) {
                // 전환 시작
                this.isTransitioning = true;
                
                // 정규식 관리 패널로 되돌리기 (애니메이션 적용)
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
                
                // 정규식 편집 모달에서 characterId 가져오기
                const modalContent = panelContainer.querySelector('.modal-content');
                const characterId = modalContent?.dataset?.characterId || null;
                const currentCharacterId = characterId || (this.callbacks.getCurrentCharacterId ? await this.callbacks.getCurrentCharacterId() : null);
                const regexHtml = await createRegexPanel(currentCharacterId);
                panelContainer.classList.remove('closing');
                panelContainer.innerHTML = regexHtml;
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
                
                this.setupRegexPanelEvents(panelContainer);
                this.setupPanelClickHandler(panelContainer);
                
                const regexCloseBtn = panelContainer.querySelector('.close-panel-btn');
                if (regexCloseBtn) {
                    regexCloseBtn.addEventListener('click', () => this.closePanelModal());
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
                this.isTransitioning = false;
                return;
            }
            
            // 그 외의 경우 모달 닫기
            this.closePanelModal();
        };
        
        // 핸들러를 패널 컨테이너에 저장
        panelContainer._panelClickHandler = clickHandler;
        panelContainer.addEventListener('click', clickHandler);
    }

    /**
     * 오버레이 클릭 이벤트 설정
     */
    setupOverlay() {
        // 오버레이 클릭 이벤트는 한 번만 등록
        this.elements.overlay.addEventListener('click', async (e) => {
            // 오버레이가 숨겨져 있으면 클릭 이벤트 무시
            if (this.elements.overlay.classList.contains('hidden')) {
                return;
            }
            
            // 클릭한 곳이 오버레이 자체인지 확인 (모달 내부 클릭은 무시)
            if (e.target !== this.elements.overlay) {
                return;
            }

            // 패널 모달이 열려있으면 패널 닫기 (실제로 표시되어 있는지 확인)
            const panelContainer = document.getElementById('panel-modal-container');
            if (panelContainer && !panelContainer.classList.contains('hidden')) {
                // 프롬프트 팝업이 열려있으면 닫지 않음
                const promptPopup = document.getElementById('completion_prompt_manager_popup');
                if (promptPopup && promptPopup.style.display !== 'none' && !promptPopup.classList.contains('hidden')) {
                    return;
                }
                
                // 패널이 전환 중이거나 closing 애니메이션 중이거나 opacity가 0으로 설정되어 있으면 닫지 않음
                if (this.isTransitioning ||
                    panelContainer.classList.contains('closing') || 
                    panelContainer.style.opacity === '0' || 
                    getComputedStyle(panelContainer).opacity === '0') {
                    return;
                }
                
                this.closePanelModal();
                return;
            }

            // autofill 모달이 열려있으면 닫기
            const autofillModal = document.getElementById('autofill-modal-container');
            if (autofillModal && !autofillModal.classList.contains('hidden')) {
                // chatManager의 closeAutofillModal 메서드 사용 (애니메이션 포함)
                if (typeof window !== 'undefined' && window.app && window.app.chatManager) {
                    window.app.chatManager.closeAutofillModal(autofillModal);
                } else {
                    // chatManager를 찾을 수 없으면 즉시 제거 (fallback)
                    autofillModal.remove();
                    // 다른 모달이 없으면 오버레이 숨김
                    const settingsModal = document.getElementById('settings-modal');
                    const sideMenu = document.getElementById('side-menu');
                    const settingsModalOpen = settingsModal && !settingsModal.classList.contains('hidden');
                    const sideMenuOpen = sideMenu && !sideMenu.classList.contains('hidden');
                    
                    if (!settingsModalOpen && !sideMenuOpen) {
                        this.elements.overlay.classList.add('hidden');
                        this.elements.overlay.style.pointerEvents = 'none';
                    }
                }
                return;
            }

            // 패널이 없으면 사이드 메뉴와 설정 모달 닫기
            if (this.callbacks.onOverlayClick) {
                this.callbacks.onOverlayClick();
            }
        });
    }

    /**
     * 패널 모달 열기
     * @param {string} panelHtml - 패널 HTML
     * @param {string} panelType - 패널 타입
     */
    async openPanelModal(panelHtml, panelType, options = {}) {
        // 오버레이 먼저 표시 (메뉴 닫기 전에 오버레이 유지)
        this.elements.overlay.classList.remove('hidden', 'closing');
        this.elements.overlay.style.pointerEvents = '';

        // 사이드 메뉴 닫기 (오버레이는 유지)
        if (this.callbacks.onOverlayClick) {
            // 사이드 메뉴만 닫기 (설정 모달은 유지)
            const sideMenu = document.getElementById('side-menu');
            if (sideMenu && !sideMenu.classList.contains('hidden')) {
                // 메뉴만 닫고 오버레이는 유지
                sideMenu.classList.add('closing');
                sideMenu.style.pointerEvents = 'none';
                
                // 메뉴 닫기 애니메이션
                const handleTransitionEnd = (e) => {
                    if (e.propertyName !== 'transform') return;
                    sideMenu.removeEventListener('transitionend', handleTransitionEnd);
                    sideMenu.classList.remove('closing');
                    sideMenu.classList.add('hidden');
                    sideMenu.style.pointerEvents = '';
                    sideMenu.style.transform = '';
                };
                
                sideMenu.addEventListener('transitionend', handleTransitionEnd);
                // 오버레이의 closing 클래스는 제거 (이미 제거됨)
            }
        }

        // 기존 패널이 있으면 제거
        const existingPanel = document.getElementById('panel-modal-container');
        if (existingPanel) {
            existingPanel.remove();
        }

        // 패널 컨테이너 생성
        const panelContainer = document.createElement('div');
        panelContainer.id = 'panel-modal-container';
        panelContainer.className = 'modal';
        panelContainer.innerHTML = panelHtml;

        document.body.appendChild(panelContainer);
        
        // 패널 모달 자체 클릭 핸들러 설정
        this.setupPanelClickHandler(panelContainer);
        
        // 포인터 이벤트 복원
        panelContainer.style.pointerEvents = '';

        // 닫기 버튼 이벤트
        const closeBtn = panelContainer.querySelector('.close-panel-btn');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => this.closePanelModal());
        }

        // 패널별 이벤트 리스너 설정
        await this.setupPanelEvents(panelContainer, panelType);
        
        // 프롬프트 모달인 경우 토큰 계산 준비 (모달이 열릴 때 토큰 계산 수행)
    }

    /**
     * 패널 모달 닫기
     */
    closePanelModal() {
        const panelContainer = document.getElementById('panel-modal-container');
        if (panelContainer) {
            // 이미 닫히는 중이면 무시
            if (panelContainer.classList.contains('closing')) {
                return;
            }
            
            // 닫기 애니메이션 추가
            panelContainer.classList.add('closing');
            this.elements.overlay.classList.add('closing');
            
            // 즉시 클릭 방지 (애니메이션 중에도)
            panelContainer.style.pointerEvents = 'none';
            this.elements.overlay.style.pointerEvents = 'none';
            
            // 사이드 메뉴나 설정 모달이 열려있으면 오버레이 유지, 아니면 숨김
            const sideMenuOpen = !this.elements.sideMenu.classList.contains('hidden');
            const settingsModalOpen = !this.elements.settingsModal.classList.contains('hidden');
            
            // 정리 함수 (오버레이 상태 복원)
            const cleanup = () => {
                panelContainer.remove();
                
                if (!sideMenuOpen && !settingsModalOpen) {
                    this.elements.overlay.classList.remove('closing');
                    this.elements.overlay.classList.add('hidden');
                    this.elements.overlay.style.pointerEvents = 'none';
                } else {
                    this.elements.overlay.classList.remove('closing');
                    this.elements.overlay.style.pointerEvents = '';
                }
            };
            
            // 애니메이션 완료 이벤트 리스너
            let animationHandled = false;
            const handleAnimationEnd = () => {
                if (animationHandled) return;
                animationHandled = true;
                
                panelContainer.removeEventListener('animationend', handleAnimationEnd);
                cleanup();
            };
            
            // 애니메이션이 트리거되지 않는 경우를 대비한 타임아웃 (최대 500ms 후 강제 정리)
            const timeoutId = setTimeout(() => {
                if (!animationHandled) {
                    animationHandled = true;
                    panelContainer.removeEventListener('animationend', handleAnimationEnd);
                    cleanup();
                }
            }, 500);
            
            panelContainer.addEventListener('animationend', handleAnimationEnd);
            
            // 타임아웃도 정리할 수 있도록 저장
            panelContainer._closeTimeout = timeoutId;
        }
    }

    /**
     * 패널 이벤트 리스너 설정
     * @param {HTMLElement} panelContainer - 패널 컨테이너
     * @param {string} panelType - 패널 타입
     */
    async setupPanelEvents(panelContainer, panelType) {
        switch (panelType) {
            case 'characters':
                this.setupCharacterPanelEvents(panelContainer);
                break;
            case 'chat-list':
                this.setupChatListPanelEvents(panelContainer);
                break;
            case 'world-info':
                this.setupWorldInfoPanelEvents(panelContainer);
                break;
            case 'quick-reply':
                this.setupQuickReplyPanelEvents(panelContainer);
                break;
            case 'persona':
                this.setupPersonaPanelEvents(panelContainer);
                break;
            case 'character-profile':
                this.setupCharacterProfileEvents(panelContainer);
                break;
            case 'regex':
                this.setupRegexPanelEvents(panelContainer);
                break;
            case 'regex-editor':
                // modal-content 요소를 찾아서 전달 (data 속성이 여기에 있음)
                const modalContent = panelContainer.querySelector('.modal-content');
                if (modalContent) {
                    this.setupRegexEditorEvents(modalContent);
                } else {
                    // 폴백: panelContainer 사용
                    this.setupRegexEditorEvents(panelContainer);
                }
                break;
            case 'prompts':
                await setupPromptsPanelEvents(panelContainer);
                break;
            case 'templates':
                // 템플릿 패널은 현재 플레이스홀더만 있으므로 이벤트 없음
                break;
            case 'autofill-prompt':
                await setupAutofillPromptPanelEvents(panelContainer);
                break;
            case 'ai-loading':
                await this.setupAILoadingPanelEvents(panelContainer);
                break;
            case 'chat-processing':
                await this.setupChatProcessingPanelEvents(panelContainer);
                break;
            case 'data-management':
                await this.setupDataManagementPanelEvents(panelContainer);
                break;
            case 'status-bar-choice':
                await this.setupStatusBarChoicePanelEvents(panelContainer);
                break;
        }
    }

    /**
     * 캐릭터 패널 이벤트 설정
     */
    setupCharacterPanelEvents(container) {
        // 불러오기 버튼
        const importBtn = container.querySelector('#character-import-btn');
        if (importBtn && this.callbacks.importFile) {
            importBtn.addEventListener('click', () => {
                this.callbacks.importFile('character');
            });
        }

        // 새 캐릭터 버튼
        const createBtn = container.querySelector('#character-create-btn');
        if (createBtn) {
            createBtn.addEventListener('click', () => {
                showToast('새 캐릭터 생성 기능은 추후 구현 예정입니다.', 'info');
            });
        }

        // 초기 상태: 모든 항목에 data-match="true" 설정
        const items = container.querySelectorAll('.panel-item[data-character-id]');
        items.forEach(item => {
            item.setAttribute('data-match', 'true');
        });

        // 검색 입력 필드
        const searchInput = container.querySelector('#character-search-input');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                this.filterCharacters(container, e.target.value);
            });
        }
        
        // 정렬 선택
        const sortSelect = container.querySelector('#character-sort-select');
        if (sortSelect) {
            sortSelect.addEventListener('change', async (e) => {
                await this.sortCharacters(container, e.target.value);
            });
        }

        // 항목 클릭 (캐릭터 선택 - 채팅창으로 이동)
        container.querySelectorAll('.panel-item').forEach(item => {
            item.addEventListener('click', (e) => {
                if (!e.target.closest('.panel-btn')) {
                    const id = item.dataset.characterId;
                    if (id && this.callbacks.selectCharacter) {
                        this.callbacks.selectCharacter(id);
                    }
                }
            });
        });

        // 항목 액션 버튼들
        container.querySelectorAll('.panel-item .panel-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const action = btn.dataset.action;
                const id = btn.dataset.id;
                if (this.callbacks.handleCharacterAction) {
                    this.callbacks.handleCharacterAction(action, id);
                }
            });
        });
    }

    /**
     * 캐릭터 목록 필터링
     * @param {HTMLElement} container - 패널 컨테이너
     * @param {string} searchQuery - 검색어
     */
    filterCharacters(container, searchQuery) {
        const query = searchQuery.toLowerCase().trim();
        const items = container.querySelectorAll('.panel-item[data-character-id]');
        const emptyMessage = container.querySelector('.panel-empty');
        const list = container.querySelector('#character-list');

        if (!query) {
            // 검색어가 없으면 모든 항목 표시
            items.forEach(item => {
                item.style.display = '';
                item.setAttribute('data-match', 'true');
            });
            if (emptyMessage) {
                emptyMessage.style.display = items.length === 0 ? 'block' : 'none';
            }
            return;
        }

        let matchCount = 0;
        items.forEach(item => {
            const name = (item.dataset.characterName || '').toLowerCase();
            if (name.includes(query)) {
                item.style.display = '';
                item.setAttribute('data-match', 'true');
                matchCount++;
            } else {
                item.style.display = 'none';
                item.setAttribute('data-match', 'false');
            }
        });

        // 검색 결과가 없을 때 메시지 표시
        if (matchCount === 0) {
            let noResults = list.querySelector('.panel-no-results');
            if (!noResults) {
                noResults = document.createElement('div');
                noResults.className = 'panel-empty panel-no-results';
                noResults.textContent = '검색 결과가 없습니다';
                list.appendChild(noResults);
            }
            noResults.style.display = 'block';
        } else {
            const noResults = list.querySelector('.panel-no-results');
            if (noResults) {
                noResults.style.display = 'none';
            }
        }
    }
    
    /**
     * 캐릭터 목록 정렬
     * @param {HTMLElement} container - 패널 컨테이너
     * @param {string} sortType - 정렬 타입
     */
    async sortCharacters(container, sortType) {
        const list = container.querySelector('#character-list');
        const items = Array.from(container.querySelectorAll('.panel-item[data-character-id]'));
        
        if (items.length === 0) return;
        
        // ChatStorage 가져오기
        // ChatStorage - 전역 스코프에서 사용
        
        // 각 항목의 정렬 정보 추출
        const itemsWithData = await Promise.all(items.map(async (item) => {
            const id = item.dataset.characterId;
            const name = item.dataset.characterName || '';
            
            // ID에서 타임스탬프 추출 (형식: name_timestamp)
            const timestampMatch = id.match(/_(\d+)$/);
            const createTimestamp = timestampMatch ? parseInt(timestampMatch[1]) : 0;
            
            // 최근 채팅 날짜 가져오기
            const allChats = await ChatStorage.loadAll();
            let lastChatDate = 0;
            Object.values(allChats).forEach(chat => {
                const charName = chat?.character_name || chat?.metadata?.character_name || '';
                if (charName.toLowerCase() === name.toLowerCase()) {
                    const chatDate = chat?.metadata?.last_message_date || chat?.last_message_date || 0;
                    if (chatDate > lastChatDate) {
                        lastChatDate = chatDate;
                    }
                }
            });
            
            return {
                element: item,
                id,
                name,
                createTimestamp,
                lastChatDate
            };
        }));
        
        // 정렬
        itemsWithData.sort((a, b) => {
            switch (sortType) {
                case 'recent-chat':
                    // 최근 채팅순 (최근 것부터)
                    // 채팅이 없는 경우 생성순으로 대체
                    const aDate = a.lastChatDate || a.createTimestamp || 0;
                    const bDate = b.lastChatDate || b.createTimestamp || 0;
                    return bDate - aDate;
                    
                case 'create-date-desc':
                    // 생성순 (최신부터)
                    return (b.createTimestamp || 0) - (a.createTimestamp || 0);
                    
                case 'create-date-asc':
                    // 생성순 (오래된 순)
                    return (a.createTimestamp || 0) - (b.createTimestamp || 0);
                    
                case 'name-desc':
                    // 이름순 (Z-A)
                    return b.name.localeCompare(a.name, 'ko', { sensitivity: 'base' });
                    
                case 'name-asc':
                default:
                    // 이름순 (A-Z)
                    return a.name.localeCompare(b.name, 'ko', { sensitivity: 'base' });
            }
        });
        
        // DOM에서 제거 후 순서대로 재추가
        itemsWithData.forEach(({ element }) => {
            list.appendChild(element);
        });
    }

    /**
     * 채팅 목록 패널 이벤트 설정
     */
    setupChatListPanelEvents(container) {
        // 불러오기 버튼
        const importBtn = container.querySelector('#chat-import-btn');
        if (importBtn && this.callbacks.importFile) {
            importBtn.addEventListener('click', () => {
                this.callbacks.importFile('chat');
            });
        }

        // 새 채팅 버튼
        const createBtn = container.querySelector('#chat-create-btn');
        if (createBtn && this.callbacks.clearChat) {
            createBtn.addEventListener('click', async () => {
                // 새 채팅 시작 전에 현재 채팅 저장 (덮어쓰기 방지)
                if (window.chatManager && window.chatManager.currentChatId && 
                    window.chatManager.elements?.chatMessages?.children?.length > 0) {
                    try {
                        await window.chatManager.saveChat();
                    } catch (error) {
                        // 오류 코드 토스트 알림 표시
                        if (typeof showErrorCodeToast === 'function') {
                            showErrorCodeToast('ERR_PANEL_7001', '새 채팅 시작 전 채팅 저장 중 오류가 발생했습니다', error);
                        }
                    }
                }
                
                await this.callbacks.clearChat();
                showToast('새 채팅이 시작되었습니다.', 'success');
                this.closePanelModal();
            });
        }

        // 항목 클릭 시 채팅으로 이동
        container.querySelectorAll('.panel-item[data-chat-id]').forEach(item => {
            item.addEventListener('click', (e) => {
                // 버튼 클릭이 아닌 경우에만 (버튼 클릭은 stopPropagation으로 차단됨)
                if (e.target.closest('.panel-btn')) {
                    return;
                }
                const chatId = item.dataset.chatId;
                if (chatId && this.callbacks.loadChat) {
                    this.callbacks.loadChat(chatId);
                    this.closePanelModal();
                }
            });
        });

        // 항목 액션 버튼들
        container.querySelectorAll('.panel-item .panel-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const action = btn.dataset.action;
                const id = btn.dataset.id;
                if (this.callbacks.handleChatAction) {
                    this.callbacks.handleChatAction(action, id);
                }
            });
        });
    }

    /**
     * 월드인포 패널 이벤트 설정
     */
    setupWorldInfoPanelEvents(container) {
        // 불러오기 버튼
        const importBtn = container.querySelector('#world-info-import-btn');
        if (importBtn && this.callbacks.importFile) {
            importBtn.addEventListener('click', () => {
                this.callbacks.importFile('world-info');
            });
        }

        // 내보내기 버튼
        const exportBtn = container.querySelector('#world-info-export-btn');
        if (exportBtn) {
            exportBtn.addEventListener('click', () => {
                showToast('내보내기 기능은 추후 구현 예정입니다.', 'info');
            });
        }
    }

    /**
     * Quick Reply 패널 이벤트 설정
     */
    setupQuickReplyPanelEvents(container) {
        // 불러오기 버튼
        const importBtn = container.querySelector('#quick-reply-import-btn');
        if (importBtn && this.callbacks.importFile) {
            importBtn.addEventListener('click', () => {
                this.callbacks.importFile('quick-reply');
            });
        }

        // 내보내기 버튼
        const exportBtn = container.querySelector('#quick-reply-export-btn');
        if (exportBtn) {
            exportBtn.addEventListener('click', () => {
                showToast('내보내기 기능은 추후 구현 예정입니다.', 'info');
            });
        }
    }

    /**
     * 페르소나 패널 이벤트 설정
     */
    setupPersonaPanelEvents(container) {
        // 닫기 버튼 이벤트 (명시적으로 설정하여 확실히 작동하도록)
        const closeBtn = container.querySelector('.close-panel-btn');
        if (closeBtn) {
            // 기존 이벤트 리스너 제거 후 새로 추가 (중복 방지)
            const newCloseBtn = closeBtn.cloneNode(true);
            closeBtn.parentNode.replaceChild(newCloseBtn, closeBtn);
            newCloseBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.closePanelModal();
            });
        }

        // 불러오기 버튼
        const importBtn = container.querySelector('#persona-import-btn');
        if (importBtn && this.callbacks.importFile) {
            importBtn.addEventListener('click', () => {
                this.callbacks.importFile('persona');
            });
        }

        // 새 페르소나 버튼
        const createBtn = container.querySelector('#persona-create-btn');
        if (createBtn) {
            createBtn.addEventListener('click', async () => {
                // createPersonaEditorPanel, setupPersonaEditorEvents - 전역 스코프에서 사용
                const editorHtml = await createPersonaEditorPanel(null);
                
                // 기존 패널이 페르소나 목록 패널이면 내용만 교체 (패널 닫지 않음)
                const existingPanel = document.getElementById('panel-modal-container');
                let panelContainer;
                
                // 페르소나 목록 패널 확인: persona-panel 클래스 또는 #persona-import-btn 같은 고유 요소 확인
                const isPersonaPanel = existingPanel && (
                    existingPanel.querySelector('.persona-panel') ||
                    existingPanel.querySelector('#persona-import-btn') ||
                    existingPanel.querySelector('[data-panel-type="persona"]')
                );
                
                if (isPersonaPanel) {
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
                    
                    existingPanel.classList.remove('closing');
                    existingPanel.innerHTML = editorHtml;
                    existingPanel.style.opacity = '0';
                    existingPanel.style.transform = 'translateY(20px) scale(0.95)';
                    existingPanel.style.pointerEvents = '';
                    panelContainer = existingPanel;
                    
                    // DOM이 완전히 렌더링될 때까지 대기
                    await new Promise(resolve => {
                        requestAnimationFrame(() => {
                            requestAnimationFrame(() => {
                                resolve();
                            });
                        });
                    });
                    
                    // 애니메이션 시작
                    requestAnimationFrame(() => {
                        requestAnimationFrame(() => {
                            existingPanel.style.transition = 'all var(--transition-normal)';
                            existingPanel.style.opacity = '1';
                            existingPanel.style.transform = 'translateY(0) scale(1)';
                        });
                    });
                } else {
                    // 기존 패널이 없거나 다른 패널이면 새로 생성
                    panelContainer = document.createElement('div');
                    panelContainer.id = 'panel-modal-container';
                    panelContainer.className = 'modal';
                    panelContainer.innerHTML = editorHtml;
                    document.body.appendChild(panelContainer);
                    this.elements.overlay.classList.remove('hidden');
                    
                    // 패널 클릭 핸들러 설정
                    this.setupPanelClickHandler(panelContainer);
                }
                
                setupPersonaEditorEvents(panelContainer, async (personaId, personaData) => {
                    // 저장 후 페르소나 목록 새로고침 (애니메이션 적용)
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
                    
                    const newPanelHtml = await createPersonaPanel();
                    panelContainer.classList.remove('closing');
                    panelContainer.innerHTML = newPanelHtml;
                    panelContainer.style.opacity = '0';
                    panelContainer.style.transform = 'translateY(20px) scale(0.95)';
                    panelContainer.style.pointerEvents = '';
                    
                    // DOM이 완전히 렌더링될 때까지 대기
                    await new Promise(resolve => {
                        requestAnimationFrame(() => {
                            requestAnimationFrame(() => {
                                resolve();
                            });
                        });
                    });
                    
                    // 이벤트 리스너 재설정 (닫기 버튼 포함)
                    this.setupPersonaPanelEvents(panelContainer);
                    this.setupPanelClickHandler(panelContainer);
                    
                    const closeBtn = panelContainer.querySelector('.close-panel-btn');
                    if (closeBtn) {
                        closeBtn.addEventListener('click', () => this.closePanelModal());
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
                });
                
                // 닫기 버튼 이벤트는 setupPersonaEditorEvents 내부에서 처리됨
            });
        }

        // 항목 액션 버튼들
        container.querySelectorAll('.panel-item .panel-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const action = btn.dataset.action;
                const id = btn.dataset.id;
                if (this.callbacks.handlePersonaAction) {
                    this.callbacks.handlePersonaAction(action, id);
                }
            });
        });
    }

    /**
     * 캐릭터 프로필 이벤트 설정
     * @param {HTMLElement} container - 패널 컨테이너
     */
    setupCharacterProfileEvents(container) {
        if (!container) return;

        const form = container.querySelector('#character-profile-form');
        const cancelBtn = container.querySelector('#char-profile-cancel-btn');
        const exportBtn = container.querySelector('#char-profile-export-btn');

        // 저장 버튼
        if (form && this.callbacks.saveCharacterProfile) {
            form.addEventListener('submit', (e) => {
                e.preventDefault();
                this.callbacks.saveCharacterProfile(form);
            });
        }

        // 취소 버튼
        if (cancelBtn) {
            cancelBtn.addEventListener('click', async () => {
                // 캐릭터 목록 패널로 되돌리기
                const panelContainer = document.getElementById('panel-modal-container');
                if (panelContainer) {
                    // 캐릭터 편집 모달인지 확인
                    const isCharacterProfile = panelContainer.querySelector('#character-profile-form');
                    if (isCharacterProfile) {
                        // 이전 패널 타입 확인 (캐릭터 관리 모달에서 열었는지)
                        const previousPanelType = panelContainer.dataset.previousPanelType;
                        
                        if (previousPanelType === 'characters') {
                            // 캐릭터 관리 모달에서 열었으면 그곳으로 돌아가기
                            // 전환 시작
                            this.isTransitioning = true;
                            
                            // 캐릭터 목록 패널로 되돌리기 (애니메이션 적용)
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
                            
                            // 이전 패널 타입 제거 (다시 설정하지 않음)
                            delete panelContainer.dataset.previousPanelType;
                            
                            // DOM이 완전히 렌더링될 때까지 대기
                            await new Promise(resolve => {
                                requestAnimationFrame(() => {
                                    requestAnimationFrame(() => {
                                        resolve();
                                    });
                                });
                            });
                            
                            this.setupCharacterPanelEvents(panelContainer);
                            this.setupPanelClickHandler(panelContainer);
                            
                            const listCloseBtn = panelContainer.querySelector('.close-panel-btn');
                            if (listCloseBtn) {
                                listCloseBtn.addEventListener('click', () => this.closePanelModal());
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
                            this.isTransitioning = false;
                        } else {
                            // 직접 열었으면 (plus-menu나 char-info-profile에서) 완전히 닫기
                            this.closePanelModal();
                        }
                    } else {
                        this.closePanelModal();
                    }
                } else {
                    this.closePanelModal();
                }
            });
        }
        
        // 닫기 버튼 (X 버튼) - 캐릭터 편집 모달의 경우 캐릭터 목록으로 되돌리기
        const closeBtn = container.querySelector('.close-panel-btn');
        if (closeBtn) {
            // 기존 이벤트 리스너 제거
            const newCloseBtn = closeBtn.cloneNode(true);
            closeBtn.parentNode.replaceChild(newCloseBtn, closeBtn);
            
            // 새 이벤트 리스너 추가
            const finalCloseBtn = container.querySelector('.close-panel-btn');
            finalCloseBtn.addEventListener('click', async () => {
                const panelContainer = document.getElementById('panel-modal-container');
                if (panelContainer) {
                    // 캐릭터 편집 모달인지 확인
                    const isCharacterProfile = panelContainer.querySelector('#character-profile-form');
                    if (isCharacterProfile) {
                        // 이전 패널 타입 확인 (캐릭터 관리 모달에서 열었는지)
                        const previousPanelType = panelContainer.dataset.previousPanelType;
                        
                        if (previousPanelType === 'characters') {
                            // 캐릭터 관리 모달에서 열었으면 그곳으로 돌아가기
                            // 전환 시작
                            this.isTransitioning = true;
                            
                            // 캐릭터 목록 패널로 되돌리기 (애니메이션 적용)
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
                            
                            // 이전 패널 타입 제거 (다시 설정하지 않음)
                            delete panelContainer.dataset.previousPanelType;
                            
                            // DOM이 완전히 렌더링될 때까지 대기
                            await new Promise(resolve => {
                                requestAnimationFrame(() => {
                                    requestAnimationFrame(() => {
                                        resolve();
                                    });
                                });
                            });
                            
                            this.setupCharacterPanelEvents(panelContainer);
                            this.setupPanelClickHandler(panelContainer);
                            
                            const listCloseBtn = panelContainer.querySelector('.close-panel-btn');
                            if (listCloseBtn) {
                                listCloseBtn.addEventListener('click', () => this.closePanelModal());
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
                            this.isTransitioning = false;
                        } else {
                            // 직접 열었으면 (plus-menu나 char-info-profile에서) 완전히 닫기
                            this.closePanelModal();
                        }
                    } else {
                        this.closePanelModal();
                    }
                } else {
                    this.closePanelModal();
                }
            });
        }

        // 내보내기 버튼
        if (exportBtn) {
            exportBtn.addEventListener('click', () => {
                showToast('내보내기 기능은 추후 구현 예정입니다.', 'info');
            });
        }

        // 이미지 업로드 버튼
        const imageUploadBtn = container.querySelector('#char-profile-image-upload-btn');
        const imageInput = container.querySelector('#char-profile-image-input');
        const imageRemoveBtn = container.querySelector('#char-profile-image-remove-btn');
        const profileImage = container.querySelector('#char-profile-image');
        
        if (imageUploadBtn && imageInput && profileImage) {
            imageUploadBtn.addEventListener('click', () => {
                imageInput.click();
            });

            imageInput.addEventListener('change', (e) => {
                const file = e.target.files[0];
                if (!file) return;

                if (!file.type.startsWith('image/')) {
                    showToast('이미지 파일만 업로드할 수 있습니다.', 'warning');
                    return;
                }

                const reader = new FileReader();
                reader.onload = (event) => {
                    const imageDataUrl = event.target.result;
                    // placeholder div가 있으면 img로 교체
                    if (profileImage.classList.contains('profile-image-placeholder')) {
                        const img = document.createElement('img');
                        img.id = 'char-profile-image';
                        img.className = 'profile-image';
                        img.src = imageDataUrl;
                        img.alt = profileImage.querySelector('i')?.parentElement?.alt || '프로필 이미지';
                        img.onerror = () => {
                            img.outerHTML = '<div id="char-profile-image" class="profile-image-placeholder"><i class="fa-solid fa-user"></i></div>';
                        };
                        profileImage.parentNode.replaceChild(img, profileImage);
                        // 삭제 버튼 표시
                        if (imageRemoveBtn) {
                            imageRemoveBtn.style.display = 'inline-flex';
                        }
                    } else {
                        profileImage.src = imageDataUrl;
                        profileImage.onerror = () => {
                            profileImage.outerHTML = '<div id="char-profile-image" class="profile-image-placeholder"><i class="fa-solid fa-user"></i></div>';
                            // 삭제 버튼 숨기기
                            if (imageRemoveBtn) {
                                imageRemoveBtn.style.display = 'none';
                            }
                        };
                        // 삭제 버튼 표시
                        if (imageRemoveBtn) {
                            imageRemoveBtn.style.display = 'inline-flex';
                        }
                    }
                    // input 초기화
                    imageInput.value = '';
                };
                reader.onerror = () => {
                    showToast('이미지를 읽는 중 오류가 발생했습니다.', 'error');
                };
                reader.readAsDataURL(file);
            });
        }

        // 이미지 삭제 버튼
        if (imageRemoveBtn && profileImage) {
            imageRemoveBtn.addEventListener('click', () => {
                // 이미지가 있으면 placeholder로 교체
                const currentImage = container.querySelector('#char-profile-image');
                if (currentImage && currentImage.tagName === 'IMG') {
                    const placeholder = document.createElement('div');
                    placeholder.id = 'char-profile-image';
                    placeholder.className = 'profile-image-placeholder';
                    const icon = document.createElement('i');
                    icon.className = 'fa-solid fa-user';
                    placeholder.appendChild(icon);
                    currentImage.parentNode.replaceChild(placeholder, currentImage);
                    // 삭제 버튼 숨기기
                    imageRemoveBtn.style.display = 'none';
                    // input 초기화
                    if (imageInput) {
                        imageInput.value = '';
                    }
                }
            });
        }

        // 그리팅 편집 버튼
        const greetingsEditBtn = container.querySelector('#char-greetings-edit-btn');
        if (greetingsEditBtn && form) {
            greetingsEditBtn.addEventListener('click', async () => {
                const characterId = form.dataset.characterId;
                if (!characterId) return;

                await this.openGreetingsEditor(characterId);
            });
        }
    }

    /**
     * 그리팅 편집 모달 열기
     * @param {string} characterId - 캐릭터 ID
     */
    async openGreetingsEditor(characterId) {
        // createGreetingsEditorModal, setupGreetingsEditorEvents - 전역 스코프에서 사용
        // CharacterStorage - 전역 스코프에서 사용
        
        // 기존 모달이 있으면 제거
        const existingModal = document.getElementById('greetings-editor-modal-container');
        if (existingModal) {
            existingModal.remove();
        }

        const modalContainer = document.createElement('div');
        modalContainer.id = 'greetings-editor-modal-container';
        modalContainer.className = 'modal';
        modalContainer.innerHTML = await createGreetingsEditorModal(characterId);

        const overlay = document.getElementById('overlay');
        if (overlay) {
            overlay.classList.remove('hidden');
        }

        document.body.appendChild(modalContainer);

        await setupGreetingsEditorEvents(
            modalContainer,
            async (charId, firstMes, alternateGreetings) => {
                // 그리팅 저장
                const character = await CharacterStorage.load(charId);
                if (!character) {
                    throw new Error('캐릭터를 찾을 수 없습니다.');
                }

                const updatedCharacter = {
                    ...character,
                    first_mes: firstMes,
                    data: {
                        ...(character.data || {}),
                        first_mes: firstMes,
                        first_message: firstMes,
                        alternate_greetings: alternateGreetings,
                    },
                };

                await CharacterStorage.save(charId, updatedCharacter);
                
                // 캐릭터 프로필이 열려있으면 새로고침
                const profilePanel = document.getElementById('panel-modal-container');
                if (profilePanel && profilePanel.dataset.panelType === 'character-profile') {
                    // createCharacterProfilePanel - 전역 스코프에서 사용
                    profilePanel.innerHTML = await createCharacterProfilePanel(charId);
                    this.setupCharacterProfileEvents(profilePanel);
                }

                showToast('그리팅이 저장되었습니다.', 'success');
            },
            () => {
                modalContainer.remove();
                const overlay = document.getElementById('overlay');
                if (overlay && !overlay.classList.contains('hidden')) {
                    overlay.classList.add('hidden');
                }
            }
        );
    }

    /**
     * 패널 UI 새로고침
     * @param {string} type - 패널 타입
     */
    async refreshPanelUI(type) {
        const panelContainer = document.getElementById('panel-modal-container');
        if (!panelContainer) {
            // 패널이 열려있지 않으면 새로고침하지 않음 (나중에 열 때 최신 데이터 로드됨)
            return;
        }

        const panelTypeMap = {
            'character': 'characters',
            'chat': 'chats',
            'world-info': 'world-info',
            'quick-reply': 'quick-reply',
            'persona': 'persona',
        };

        const panelType = panelTypeMap[type] || type;
        let panelHtml;

        switch (panelType) {
            case 'characters':
                panelHtml = await createCharactersPanel();
                panelContainer.innerHTML = panelHtml;
                this.setupCharacterPanelEvents(panelContainer);
                break;
            case 'world-info':
                panelHtml = await createWorldInfoPanel();
                panelContainer.innerHTML = panelHtml;
                this.setupWorldInfoPanelEvents(panelContainer);
                break;
            case 'quick-reply':
                panelHtml = await createQuickReplyPanel();
                panelContainer.innerHTML = panelHtml;
                this.setupQuickReplyPanelEvents(panelContainer);
                break;
            case 'persona':
                panelHtml = await createPersonaPanel();
                panelContainer.innerHTML = panelHtml;
                this.setupPersonaPanelEvents(panelContainer);
                break;
            case 'regex':
                const currentCharacterId = this.callbacks.getCurrentCharacterId ? await this.callbacks.getCurrentCharacterId() : null;
                // createRegexPanel - 전역 스코프에서 사용
                panelHtml = await createRegexPanel(currentCharacterId);
                panelContainer.innerHTML = panelHtml;
                this.setupRegexPanelEvents(panelContainer);
                break;
            default:
                return;
        }

        // 닫기 버튼 이벤트 다시 설정
        const closeBtn = panelContainer.querySelector('.close-panel-btn');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => this.closePanelModal());
        }
    }

    /**
     * AI 로딩 패널 이벤트 설정
     */
    async setupAILoadingPanelEvents(container) {
        // AILoadingStorage - 전역 스코프에서 사용
        
        // 토글 이벤트
        const toggle = container.querySelector('#ai-loading-toggle');
        if (toggle) {
            toggle.addEventListener('change', async (e) => {
                const enabled = e.target.checked;
                await AILoadingStorage.saveEnabled(enabled);
            });
        }
        
        // 프리셋 선택 이벤트
        const presetSelect = container.querySelector('#ai-loading-preset-select');
        if (presetSelect) {
            presetSelect.addEventListener('change', async (e) => {
                const presetId = e.target.value;
                if (!presetId) {
                    // 기본값으로 설정
                    await AILoadingStorage.saveCurrentPresetId(null);
                    const htmlTextarea = container.querySelector('#ai-loading-html');
                    const cssTextarea = container.querySelector('#ai-loading-css');
                    if (htmlTextarea) htmlTextarea.value = '';
                    if (cssTextarea) cssTextarea.value = '';
                    return;
                }
                
                const preset = await AILoadingStorage.loadPreset(presetId);
                if (preset) {
                    await AILoadingStorage.saveCurrentPresetId(presetId);
                    const htmlTextarea = container.querySelector('#ai-loading-html');
                    const cssTextarea = container.querySelector('#ai-loading-css');
                    if (htmlTextarea) htmlTextarea.value = preset.html || '';
                    if (cssTextarea) cssTextarea.value = preset.css || '';
                }
            });
        }
        
        // 프리셋 추가 버튼
        const addBtn = container.querySelector('#ai-loading-add-btn');
        if (addBtn) {
            addBtn.addEventListener('click', async () => {
                const htmlTextarea = container.querySelector('#ai-loading-html');
                const cssTextarea = container.querySelector('#ai-loading-css');
                
                if (!htmlTextarea || !cssTextarea) {
                    showToast('HTML 또는 CSS 입력 칸을 찾을 수 없습니다.', 'error');
                    return;
                }
                
                const html = htmlTextarea.value.trim();
                const css = cssTextarea.value.trim();
                
                if (!html && !css) {
                    showToast('HTML 또는 CSS를 입력해주세요.', 'warning');
                    return;
                }
                
                // 프리셋 이름 입력 받기
                const presetName = await showInputModal('프리셋 이름을 입력하세요:', '프리셋 이름');
                if (!presetName || !presetName.trim()) {
                    return;
                }
                
                // UUID 생성
                const uuid = () => {
                    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
                        const r = Math.random() * 16 | 0;
                        const v = c === 'x' ? r : (r & 0x3 | 0x8);
                        return v.toString(16);
                    });
                };
                
                const presetId = uuid();
                
                // 프리셋 저장
                await AILoadingStorage.savePreset(presetId, {
                    name: presetName.trim(),
                    html: html,
                    css: css
                });
                
                // 현재 선택된 프리셋으로 설정
                await AILoadingStorage.saveCurrentPresetId(presetId);
                
                // 프리셋 선택 드롭다운 업데이트
                // createAILoadingPanel - 전역 스코프에서 사용
                const newPanelHtml = await createAILoadingPanel();
                const modalContent = container.querySelector('.modal-content');
                if (modalContent) {
                    modalContent.innerHTML = newPanelHtml;
                    // 이벤트 재설정
                    this.setupAILoadingPanelEvents(container);
                    // 닫기 버튼 이벤트 재설정
                    const closeBtn = container.querySelector('.close-panel-btn');
                    if (closeBtn) {
                        closeBtn.addEventListener('click', () => this.closePanelModal());
                    }
                }
            });
        }
        
        // 프리셋 저장 버튼
        const saveBtn = container.querySelector('#ai-loading-save-btn');
        if (saveBtn) {
            saveBtn.addEventListener('click', async () => {
                const htmlTextarea = container.querySelector('#ai-loading-html');
                const cssTextarea = container.querySelector('#ai-loading-css');
                const presetSelect = container.querySelector('#ai-loading-preset-select');
                
                if (!htmlTextarea || !cssTextarea || !presetSelect) {
                    showToast('입력 칸을 찾을 수 없습니다.', 'error');
                    return;
                }
                
                const currentPresetId = presetSelect.value;
                
                if (!currentPresetId) {
                    showToast('저장할 프리셋을 선택해주세요. 프리셋이 없으면 "추가" 버튼을 사용하여 새로 만드세요.', 'warning');
                    return;
                }
                
                const html = htmlTextarea.value.trim();
                const css = cssTextarea.value.trim();
                
                // 현재 프리셋 로드
                const preset = await AILoadingStorage.loadPreset(currentPresetId);
                if (!preset) {
                    showToast('선택된 프리셋을 찾을 수 없습니다.', 'error');
                    return;
                }
                
                // 프리셋 업데이트
                await AILoadingStorage.savePreset(currentPresetId, {
                    name: preset.name,
                    html: html,
                    css: css
                });
                
                showToast(`프리셋 "${preset.name}"이(가) 저장되었습니다.`, 'success');
            });
        }
        
        // 미리보기 버튼
        const previewBtn = container.querySelector('#ai-loading-preview-btn');
        if (previewBtn) {
            previewBtn.addEventListener('click', async () => {
                const htmlTextarea = container.querySelector('#ai-loading-html');
                const cssTextarea = container.querySelector('#ai-loading-css');
                
                if (!htmlTextarea || !cssTextarea) {
                    showToast('HTML 또는 CSS 입력 칸을 찾을 수 없습니다.', 'error');
                    return;
                }
                
                const html = htmlTextarea.value.trim();
                const css = cssTextarea.value.trim();
                
                // 기본값 사용 (HTML/CSS가 비어있는 경우)
                let previewHtml = html || `<div class="ai-loader-content">
    <div class="ai-loader-spinner">
        <i class="fa-solid fa-gear fa-spin"></i>
    </div>
</div>`;
                
                let previewCss = css || `.ai-loader-content {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
}

.ai-loader-spinner {
    font-size: 48px;
    color: var(--accent-green);
    animation: spin 2s linear infinite;
}

@keyframes spin {
    from {
        transform: rotate(0deg);
    }
    to {
        transform: rotate(360deg);
    }
}`;
                
                // AI 로더 요소 찾기
                let aiLoader = document.getElementById('ai-loader');
                if (!aiLoader) {
                    // AI 로더가 없으면 생성
                    aiLoader = document.createElement('div');
                    aiLoader.id = 'ai-loader';
                    aiLoader.className = 'ai-loader';
                    document.body.appendChild(aiLoader);
                }
                
                // 기존 스타일 제거
                const existingStyle = document.getElementById('ai-loader-preview-style');
                if (existingStyle) {
                    existingStyle.remove();
                }
                
                // CSS 동적 적용
                if (previewCss) {
                    const style = document.createElement('style');
                    style.id = 'ai-loader-preview-style';
                    style.textContent = previewCss;
                    document.head.appendChild(style);
                }
                
                // 사용자 HTML을 중앙 배치 div로 감싸기
                const wrapper = document.createElement('div');
                wrapper.className = 'ai-loader-wrapper';
                wrapper.innerHTML = previewHtml;
                
                // 기존 내용 제거 후 새 내용 추가
                aiLoader.innerHTML = '';
                aiLoader.appendChild(wrapper);
                
                // 로더 표시
                aiLoader.classList.remove('hidden');
                
                // 3초 후 자동으로 숨김 (또는 사용자가 클릭하면)
                let timeoutId = setTimeout(() => {
                    aiLoader.classList.add('hidden');
                    timeoutId = null;
                }, 3000);
                
                // 로더 클릭 시 즉시 숨김
                aiLoader.addEventListener('click', function hideLoader() {
                    if (timeoutId) {
                        clearTimeout(timeoutId);
                        timeoutId = null;
                    }
                    aiLoader.classList.add('hidden');
                    aiLoader.removeEventListener('click', hideLoader);
                }, { once: true });
            });
        }
        
        // 프리셋 내보내기 버튼
        const exportBtn = container.querySelector('#ai-loading-export-btn');
        if (exportBtn) {
            exportBtn.addEventListener('click', async () => {
                const presetSelect = container.querySelector('#ai-loading-preset-select');
                
                if (!presetSelect) {
                    showToast('프리셋 선택 칸을 찾을 수 없습니다.', 'error');
                    return;
                }
                
                const currentPresetId = presetSelect.value;
                
                // 현재 선택된 프리셋이 있으면 단일 프리셋, 없으면 모든 프리셋 내보내기
                // exportAILoadingPreset - 전역 스코프에서 사용
                const result = await exportAILoadingPreset(currentPresetId || null);
                
                if (result.success) {
                    showToast(`프리셋 내보내기 성공! 내보낸 프리셋: ${result.count}개`, 'success');
                } else {
                    showToast(`프리셋 내보내기 실패: ${result.error}`, 'error');
                }
            });
        }
        
        // 프리셋 불러오기 버튼
        const importBtn = container.querySelector('#ai-loading-import-btn');
        if (importBtn) {
            // 숨겨진 파일 입력 요소 생성 또는 재사용
            let fileInput = document.getElementById('import-ai-loading-preset-input');
            
            if (!fileInput) {
                fileInput = document.createElement('input');
                fileInput.type = 'file';
                fileInput.id = 'import-ai-loading-preset-input';
                fileInput.style.display = 'none';
                fileInput.accept = '.json';
                fileInput.multiple = false;
                document.body.appendChild(fileInput);
                
                fileInput.addEventListener('change', async (e) => {
                    const file = e.target.files[0];
                    if (!file) return;
                    
                    // importAILoadingPreset - 전역 스코프에서 사용
                    const result = await importAILoadingPreset(file);
                    
                    if (result.success) {
                        showToast(`프리셋 불러오기 성공! 파일: ${file.name}, 불러온 프리셋: ${result.count}개`, 'success');
                        
                        // 패널 새로고침
                        // createAILoadingPanel - 전역 스코프에서 사용
                        const newPanelHtml = await createAILoadingPanel();
                        const modalContent = container.querySelector('.modal-content');
                        if (modalContent) {
                            modalContent.innerHTML = newPanelHtml;
                            // 이벤트 재설정
                            await this.setupAILoadingPanelEvents(container);
                            // 닫기 버튼 이벤트 재설정
                            const closeBtn = container.querySelector('.close-panel-btn');
                            if (closeBtn) {
                                closeBtn.addEventListener('click', () => this.closePanelModal());
                            }
                        }
                    } else {
                        showToast(`프리셋 불러오기 실패: ${result.error}`, 'error');
                    }
                    
                    // 입력 초기화
                    e.target.value = '';
                });
            }
            
            importBtn.addEventListener('click', () => {
                fileInput.click();
            });
        }
    }

    /**
     * 채팅 처리 패널 이벤트 설정
     */
    async setupChatProcessingPanelEvents(container) {
        // SettingsStorage - 전역 스코프에서 사용
        
        // 입력 값 변경 시 자동 저장 (debounce)
        let saveTimeout = null;
        const messagesToLoadInput = container.querySelector('#messages-to-load');
        
        if (messagesToLoadInput) {
            messagesToLoadInput.addEventListener('input', async (e) => {
                const value = parseInt(e.target.value) || 0;
                
                // 음수 방지
                if (value < 0) {
                    e.target.value = '0';
                    return;
                }
                
                // Debounce: 입력이 멈춘 후 500ms 후에 저장
                clearTimeout(saveTimeout);
                saveTimeout = setTimeout(async () => {
                const settings = await SettingsStorage.load();
                settings.messagesToLoad = value;
                await SettingsStorage.save(settings);
                }, 500);
            });
            
            // 포커스 아웃 시 즉시 저장
            messagesToLoadInput.addEventListener('blur', async (e) => {
                clearTimeout(saveTimeout);
                const value = parseInt(e.target.value) || 0;
                const settings = await SettingsStorage.load();
                settings.messagesToLoad = value;
                await SettingsStorage.save(settings);
            });
        }
        
        // HTML 렌더링 제한 입력 처리
        let htmlRenderSaveTimeout = null;
        const htmlRenderLimitInput = container.querySelector('#html-render-limit');
        const htmlRenderLimitApplyBtn = container.querySelector('#html-render-limit-apply-btn');
        
        if (htmlRenderLimitInput) {
            htmlRenderLimitInput.addEventListener('input', async (e) => {
                const value = parseInt(e.target.value) || 0;
                
                // 음수 방지
                if (value < 0) {
                    e.target.value = '0';
                    return;
                }
                
                // 자동 저장은 하지 않고, 적용 버튼 클릭 시에만 저장하고 적용
            });
        }
        
        // HTML 렌더링 제한 적용 버튼 클릭 이벤트
        if (htmlRenderLimitApplyBtn && htmlRenderLimitInput) {
            htmlRenderLimitApplyBtn.addEventListener('click', async () => {
                const value = parseInt(htmlRenderLimitInput.value) || 0;
                
                // 음수 방지
                if (value < 0) {
                    htmlRenderLimitInput.value = '0';
                    return;
                }
                
                // 설정 저장
                const settings = await SettingsStorage.load();
                settings.htmlRenderLimit = value;
                await SettingsStorage.save(settings);
                
                // 현재 열려있는 채팅의 모든 메시지에 즉시 적용
                if (window.chatManager && window.chatManager.elements && window.chatManager.elements.chatMessages) {
                    const chatMessages = window.chatManager.elements.chatMessages;
                    const allMessageWrappers = Array.from(chatMessages.querySelectorAll('.message-wrapper'))
                        .filter(wrapper => !wrapper.classList.contains('message-hidden') && wrapper.style.display !== 'none');
                    
                    if (allMessageWrappers.length > 0) {
                        // DOM 업데이트 완료 대기
                        await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
                        
                        // 역순 인덱스 계산: 최근 메시지가 인덱스 0, 1, 2...
                        const reversedWrappers = [...allMessageWrappers].reverse();
                        
                        reversedWrappers.forEach((wrapper, reverseIndex) => {
                            // reverseIndex가 0이면 최근 메시지, 1이면 그 다음 최근 메시지...
                            const messageText = wrapper.querySelector('.message-text');
                            
                            if (messageText) {
                                if (value > 0 && reverseIndex >= value) {
                                    // 제한 범위를 벗어난 메시지는 플레이스홀더로 교체
                                    window.chatManager.renderHtmlIframesInElement(messageText, true);
                                } else {
                                    // 제한 범위 내의 메시지는 렌더링 (플레이스홀더가 있으면 복원)
                                    window.chatManager.renderHtmlIframesInElement(messageText, false);
                                }
                            }
                        });
                        
                        // 성공 메시지 표시
                        if (window.showToast) {
                            const messageText = value > 0 
                                ? `최근 ${value}개 메시지` 
                                : '모든 메시지';
                            window.showToast(
                                `HTML 렌더링 제한이 적용되었습니다. (${messageText})`,
                                'success',
                                2000
                            );
                        }
                    }
                }
            });
        }
    }

    /**
     * 데이터 관리 패널 이벤트 설정
     */
    async setupDataManagementPanelEvents(container) {
        // 모든 Storage 클래스들 - 전역 스코프에서 사용
        
        // 모든 데이터 내보내기 버튼
        const exportAllDataBtn = container.querySelector('#export-all-data');
        if (exportAllDataBtn) {
            exportAllDataBtn.addEventListener('click', async () => {
                try {
                    // 모든 데이터 수집
                    const chats = await ChatStorage.loadAll();
                    const characters = await CharacterStorage.loadAll();
                    const settings = await SettingsStorage.load();
                    const personas = await UserPersonaStorage.loadAll();
                    const worldInfo = await WorldInfoStorage.load();
                    const quickReply = await QuickReplyStorage.load();
                    const regexScripts = await RegexScriptStorage.loadAll();
                    const aiLoadingPresets = await AILoadingStorage.loadAllPresets();
                    
                    // 프롬프트 프리셋 (주요 API만, 필요시 확장 가능)
                    const openaiPresets = await PresetStorage.loadAll('openai');
                    
                    const allData = {
                        version: '1.0',
                        exportDate: new Date().toISOString(),
                        chats: chats,
                        characters: characters,
                        settings: settings,
                        personas: personas,
                        worldInfo: worldInfo,
                        quickReply: quickReply,
                        regexScripts: regexScripts,
                        aiLoadingPresets: aiLoadingPresets,
                        presets: {
                            openai: openaiPresets,
                        },
                    };
                    
                    // JSON 파일로 다운로드 (저장 위치 선택 가능)
                    const jsonStr = JSON.stringify(allData, null, 2);
                    const blob = new Blob([jsonStr], { type: 'application/json' });
                    const fileName = `mobile-chat-app-backup-${new Date().toISOString().split('T')[0]}.json`;
                    
                    // downloadBlob 함수 사용 (저장 위치 선택 가능)
                    const downloadBlobFunc = typeof window !== 'undefined' && window.downloadBlobUtil ? window.downloadBlobUtil : null;
                    let downloadSuccess = false;
                    if (downloadBlobFunc) {
                        downloadSuccess = await downloadBlobFunc(blob, fileName);
                    } else {
                        // 폴백: 기본 다운로드 방식
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = fileName;
                        document.body.appendChild(a);
                        a.click();
                        document.body.removeChild(a);
                        URL.revokeObjectURL(url);
                        downloadSuccess = true; // 기본 다운로드 방식은 항상 성공으로 간주
                    }
                    
                    if (downloadSuccess) {
                        showToast('모든 데이터가 성공적으로 내보내졌습니다.', 'success');
                    }
                    // 취소 시에는 메시지 표시 안 함
                } catch (error) {
                    // 오류 코드 토스트 알림 표시
                    if (typeof showErrorCodeToast === 'function') {
                        showErrorCodeToast('ERR_PANEL_7002', '데이터 내보내기 오류', error);
                    } else if (typeof showToast === 'function') {
                        showToast('데이터 내보내기 중 오류가 발생했습니다: ' + error.message, 'error');
                    }
                }
            });
        }
        
        // 데이터 가져오기 버튼
        const importAllDataBtn = container.querySelector('#import-all-data');
        const importAllDataFile = container.querySelector('#import-all-data-file');
        if (importAllDataBtn && importAllDataFile) {
            importAllDataBtn.addEventListener('click', () => {
                importAllDataFile.click();
            });
            
            importAllDataFile.addEventListener('change', async (e) => {
                const file = e.target.files[0];
                if (!file) return;
                
                try {
                    const text = await file.text();
                    const allData = JSON.parse(text);
                    
                    // 데이터 검증
                    if (!allData.version || !allData.exportDate) {
                        showToast('유효하지 않은 백업 파일입니다.', 'error');
                        return;
                    }
                    
                    // 확인 대화상자
                    const confirmed = await showConfirmModal('백업 파일을 가져오면 현재 데이터가 덮어씌워집니다. 계속하시겠습니까?', '데이터 가져오기', { confirmType: 'danger' });
                    if (!confirmed) {
                        e.target.value = '';
                        return;
                    }
                    
                    // 데이터 복원
                    if (allData.chats) {
                        await ChatStorage.saveAll(allData.chats);
                    }
                    if (allData.characters) {
                        await CharacterStorage.saveAll(allData.characters);
                    }
                    if (allData.settings) {
                        await SettingsStorage.save(allData.settings);
                    }
                    if (allData.personas) {
                        await UserPersonaStorage.saveAll(allData.personas);
                    }
                    if (allData.worldInfo) {
                        await WorldInfoStorage.save(allData.worldInfo);
                    }
                    if (allData.quickReply) {
                        await QuickReplyStorage.save(allData.quickReply);
                    }
                    if (allData.regexScripts) {
                        await RegexScriptStorage.saveAll(allData.regexScripts);
                    }
                    if (allData.aiLoadingPresets) {
                        // AI 로딩 프리셋 복원
                        for (const [presetId, presetData] of Object.entries(allData.aiLoadingPresets)) {
                            await AILoadingStorage.savePreset(presetId, presetData);
                        }
                    }
                    if (allData.presets) {
                        // 프롬프트 프리셋 복원
                        if (allData.presets.openai) {
                            const openaiData = allData.presets.openai;
                            if (openaiData.presets && openaiData.preset_names) {
                                await PresetStorage.saveAll('openai', openaiData.presets, openaiData.preset_names);
                            }
                        }
                    }
                    
                    showToast('데이터가 성공적으로 가져와졌습니다. 페이지를 새로고침합니다.', 'success');
                    e.target.value = '';
                    // 자동 새로고침
                    location.reload();
                } catch (error) {
                    // 오류 코드 토스트 알림 표시
                    if (typeof showErrorCodeToast === 'function') {
                        showErrorCodeToast('ERR_PANEL_7003', '데이터 가져오기 오류', error);
                    } else if (typeof showToast === 'function') {
                        showToast('데이터 가져오기 중 오류가 발생했습니다: ' + error.message, 'error');
                    }
                    e.target.value = '';
                }
            });
        }
        
        // 모든 데이터 삭제 버튼
        const clearAllDataBtn = container.querySelector('#clear-all-data');
        if (clearAllDataBtn) {
            clearAllDataBtn.addEventListener('click', async () => {
                // 확인 대화상자 (2번)
                const firstConfirm = await showConfirmModal('정말로 모든 데이터를 삭제하시겠습니까?\n\n이 작업은 되돌릴 수 없습니다!', '데이터 삭제', { confirmType: 'danger', confirmText: '삭제' });
                if (!firstConfirm) {
                    return;
                }
                
                const secondConfirm = await showConfirmModal('마지막 확인입니다. 모든 데이터를 삭제하시겠습니까?', '최종 확인', { confirmType: 'danger', confirmText: '삭제' });
                if (!secondConfirm) {
                    return;
                }
                
                try {
                    // 모든 데이터 삭제
                    const errors = [];
                    
                    // 각 삭제 작업을 개별적으로 처리하여 일부 실패해도 나머지는 계속 진행
                    try {
                        await ChatStorage.clearAll();
                    } catch (error) {
                        // 오류 코드 토스트 알림 표시
                        if (typeof showErrorCodeToast === 'function') {
                            showErrorCodeToast('ERR_PANEL_7004', 'ChatStorage 삭제 실패', error);
                        }
                        errors.push('ChatStorage: ' + (error.message || error.toString()));
                    }
                    
                    try {
                        await CharacterStorage.clearAll();
                    } catch (error) {
                        // 오류 코드 토스트 알림 표시
                        if (typeof showErrorCodeToast === 'function') {
                            showErrorCodeToast('ERR_PANEL_7005', 'CharacterStorage 삭제 실패', error);
                        }
                        errors.push('CharacterStorage: ' + (error.message || error.toString()));
                    }
                    
                    try {
                        await SettingsStorage.clearAll();
                    } catch (error) {
                        // 오류 코드 토스트 알림 표시
                        if (typeof showErrorCodeToast === 'function') {
                            showErrorCodeToast('ERR_PANEL_7006', 'SettingsStorage 삭제 실패', error);
                        }
                        errors.push('SettingsStorage: ' + (error.message || error.toString()));
                    }
                    
                    try {
                        await UserPersonaStorage.clearAll();
                    } catch (error) {
                        // 오류 코드 토스트 알림 표시
                        if (typeof showErrorCodeToast === 'function') {
                            showErrorCodeToast('ERR_PANEL_7007', 'UserPersonaStorage 삭제 실패', error);
                        }
                        errors.push('UserPersonaStorage: ' + (error.message || error.toString()));
                    }
                    
                    // clearIndexedDB 함수가 전역 스코프에 있는지 확인
                    if (typeof clearIndexedDB !== 'function') {
                        throw new Error('clearIndexedDB 함수를 찾을 수 없습니다. storage.js가 제대로 로드되었는지 확인하세요.');
                    }
                    
                    // 나머지 스토어들 삭제
                    const stores = ['world_info', 'quick_reply', 'regex_scripts', 'ai_loading_presets', 'presets'];
                    for (const storeName of stores) {
                        try {
                            await clearIndexedDB(storeName);
                        } catch (error) {
                            // 오류 코드 토스트 알림 표시
                            if (typeof showErrorCodeToast === 'function') {
                                showErrorCodeToast('ERR_PANEL_7008', `저장소 삭제 실패: ${storeName}`, error);
                            }
                            errors.push(`${storeName}: ` + (error.message || error.toString()));
                        }
                    }
                    
                    if (errors.length > 0) {
                        // 경고 코드 토스트 알림 표시
                        if (typeof showErrorCodeToast === 'function') {
                            showErrorCodeToast('WARN_PANEL_20001', `일부 삭제 실패: ${errors.length}개 오류`);
                        } else if (typeof showToast === 'function') {
                            showToast('데이터 삭제를 완료했지만 일부 오류가 발생했습니다:\n' + errors.join('\n') + '\n\n페이지를 새로고침합니다.', 'warning');
                        }
                        // 자동 새로고침
                        location.reload();
                    } else {
                        showToast('모든 데이터가 삭제되었습니다. 페이지를 새로고침합니다.', 'success');
                        // 자동 새로고침
                        location.reload();
                    }
                } catch (error) {
                    // 오류 코드 토스트 알림 표시
                    if (typeof showErrorCodeToast === 'function') {
                        showErrorCodeToast('ERR_PANEL_7009', '데이터 삭제 오류', error);
                    } else if (typeof showToast === 'function') {
                        showToast('데이터 삭제 중 오류가 발생했습니다: ' + (error.message || error.toString() || '알 수 없는 오류'), 'error');
                    }
                }
            });
        }
    }

    /**
     * 정규식 패널 이벤트 설정
     */
    setupRegexPanelEvents(container) {
        // 현재 캐릭터 ID 가져오기
        const getCurrentCharacterId = async () => {
            if (this.callbacks.getCurrentCharacterId) {
                return await this.callbacks.getCurrentCharacterId();
            }
            return null;
        };

        // HTML에서 전달된 currentCharacterId 확인 (우선순위)
        const modalContent = container.querySelector('.panel-modal');
        const htmlCharacterId = modalContent?.dataset?.currentCharacterId || null;
        const hasCharacterFromHTML = !!(htmlCharacterId && typeof htmlCharacterId === 'string' && htmlCharacterId.trim() !== '');
        
        // 초기 상태 확인 및 설정 (HTML 기준으로만 확인)
        const characterTabBtn = container.querySelector('.regex-tab-btn[data-tab="character"]');
        if (characterTabBtn) {
            // HTML에서 이미 disabled 상태인지 확인
            const isDisabledInHTML = characterTabBtn.hasAttribute('disabled') || characterTabBtn.classList.contains('disabled');
            
            // 캐릭터가 없으면 무조건 비활성화
            if (!hasCharacterFromHTML || isDisabledInHTML) {
                // HTML에서 비활성화되었거나 characterId가 없으면 비활성화 유지
                characterTabBtn.setAttribute('disabled', 'disabled');
                characterTabBtn.disabled = true;
                characterTabBtn.classList.add('disabled');
                characterTabBtn.classList.remove('active');
                characterTabBtn.style.setProperty('pointer-events', 'none', 'important');
                characterTabBtn.style.setProperty('opacity', '0.5', 'important');
                characterTabBtn.style.setProperty('cursor', 'not-allowed', 'important');
                characterTabBtn.style.setProperty('color', 'var(--text-tertiary)', 'important');
                characterTabBtn.style.setProperty('border-bottom-color', 'transparent', 'important');
            } else if (hasCharacterFromHTML && !isDisabledInHTML) {
                // HTML에서 characterId가 전달되었고 활성화 상태면 활성화 유지
                characterTabBtn.removeAttribute('disabled');
                characterTabBtn.disabled = false;
                characterTabBtn.classList.remove('disabled');
                characterTabBtn.style.removeProperty('pointer-events');
                characterTabBtn.style.removeProperty('opacity');
                characterTabBtn.style.removeProperty('cursor');
                characterTabBtn.style.removeProperty('color');
                // 활성화 상태일 때는 border-bottom을 transparent로 설정
                characterTabBtn.style.setProperty('border-bottom', '2px solid transparent', 'important');
            }
        }

        // 탭 전환 (disabled 상태인 버튼은 이벤트 리스너 추가하지 않음)
        const tabButtons = container.querySelectorAll('.regex-tab-btn');
        const tabContents = container.querySelectorAll('.regex-tab-content');
        
        tabButtons.forEach(btn => {
            // disabled 상태인 버튼은 이벤트 리스너 추가하지 않음
            const isDisabled = btn.hasAttribute('disabled') || btn.disabled || btn.classList.contains('disabled');
            if (isDisabled) {
                // 추가로 클릭 차단을 위한 핸들러만 추가 (defensive)
                btn.addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    e.stopImmediatePropagation();
                    return false;
                }, true); // capture phase에서 차단
                return; // 이벤트 리스너 추가 안 함
            }
            
            btn.addEventListener('click', async (e) => {
                const tab = btn.dataset.tab;
                
                // 다시 한 번 disabled 체크 (defensive)
                if (btn.hasAttribute('disabled') || btn.disabled || btn.classList.contains('disabled')) {
                    e.preventDefault();
                    e.stopPropagation();
                    e.stopImmediatePropagation();
                    showToast('먼저 캐릭터를 선택해주세요.', 'warning');
                    return false;
                }
                
                // 캐릭터 한정 탭인 경우 캐릭터 선택 여부 확인
                if (tab === 'character') {
                    const characterId = await getCurrentCharacterId();
                    const hasValidCharacter = !!(characterId && typeof characterId === 'string' && characterId.trim() !== '');
                    if (!hasValidCharacter) {
                        e.preventDefault();
                        e.stopPropagation();
                        e.stopImmediatePropagation();
                        showToast('먼저 캐릭터를 선택해주세요.', 'warning');
                        return false;
                    }
                }
                
                // 탭 버튼 활성화 상태 변경
                tabButtons.forEach(b => {
                    b.classList.remove('active');
                    // border-bottom 전체를 transparent로 설정
                    b.style.setProperty('border-bottom', '2px solid transparent', 'important');
                });
                btn.classList.add('active');
                btn.style.setProperty('border-bottom', '2px solid var(--accent-green)', 'important');
                
                // 탭 내용 전환
                tabContents.forEach(content => {
                    content.style.display = 'none';
                });
                const targetTab = container.querySelector(`#regex-${tab}-tab`);
                if (targetTab) {
                    targetTab.style.display = 'block';
                }
            });
        });

        // 글로벌 정규식: 새 정규식 버튼
        const globalCreateBtn = container.querySelector('#regex-global-create-btn');
        if (globalCreateBtn) {
            globalCreateBtn.addEventListener('click', async () => {
                // createRegexEditor - 전역 스코프에서 사용
                const editorHtml = await createRegexEditor(null, 'global');
                this.openPanelModal(editorHtml, 'regex-editor');
            });
        }

        // 글로벌 정규식: 불러오기 버튼
        const globalImportBtn = container.querySelector('#regex-global-import-btn');
        if (globalImportBtn && this.callbacks.importRegex) {
            globalImportBtn.addEventListener('click', () => {
                this.callbacks.importRegex('global');
            });
        }


        // 캐릭터 한정 정규식: 새 정규식 버튼
        const characterCreateBtn = container.querySelector('#regex-character-create-btn');
        if (characterCreateBtn) {
            characterCreateBtn.addEventListener('click', async () => {
                const characterId = await getCurrentCharacterId();
                if (!characterId) {
                    showToast('먼저 캐릭터를 선택해주세요.', 'warning');
                    return;
                }
                // createRegexEditor - 전역 스코프에서 사용
                const editorHtml = await createRegexEditor(null, 'character', characterId);
                this.openPanelModal(editorHtml, 'regex-editor');
            });
        }

        // 캐릭터 한정 정규식: 불러오기 버튼
        const characterImportBtn = container.querySelector('#regex-character-import-btn');
        if (characterImportBtn && this.callbacks.importRegex) {
            characterImportBtn.addEventListener('click', async () => {
                const characterId = await getCurrentCharacterId();
                if (!characterId) {
                    showToast('먼저 캐릭터를 선택해주세요.', 'warning');
                    return;
                }
                this.callbacks.importRegex('character', characterId);
            });
        }


        // 항목 액션 버튼들 (글로벌 + 캐릭터 한정 모두)
        container.querySelectorAll('.panel-item .panel-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.stopPropagation();
                const action = btn.dataset.action;
                const id = btn.dataset.id;
                const scriptType = btn.dataset.scriptType || 'global';
                const characterId = btn.dataset.characterId || null;
                
                if (action === 'edit') {
                    // createRegexEditor - 전역 스코프에서 사용
                    const editorHtml = await createRegexEditor(id, scriptType, characterId);
                    this.openPanelModal(editorHtml, 'regex-editor');
                } else if (action === 'export') {
                    // 개별 정규식 내보내기
                    if (this.callbacks.exportRegex) {
                        await this.callbacks.exportRegex(scriptType, characterId, id);
                    }
                } else if (action === 'delete') {
                    const confirmed = await showConfirmModal('이 정규식 스크립트를 삭제하시겠습니까?', '정규식 삭제', { confirmType: 'danger' });
                    if (confirmed) {
                        // RegexScriptStorage - 전역 스코프에서 사용
                        if (scriptType === 'character' && characterId) {
                            await RegexScriptStorage.deleteCharacterRegexScript(characterId, id);
                        } else {
                            await RegexScriptStorage.delete(id);
                        }
                        // 현재 캐릭터 ID로 패널 새로고침
                        const currentCharacterId = await getCurrentCharacterId();
                        // createRegexPanel - 전역 스코프에서 사용
                        const panelHtml = await createRegexPanel(currentCharacterId);
                        this.openPanelModal(panelHtml, 'regex');
                    }
                }
            });
        });

        // 검색 기능 추가
        const setupSearch = (searchInputId, listId, scriptType) => {
            const searchInput = container.querySelector(searchInputId);
            const list = container.querySelector(listId);
            
            if (searchInput && list) {
                searchInput.addEventListener('input', (e) => {
                    const query = e.target.value.toLowerCase().trim();
                    const items = list.querySelectorAll('.regex-script-item');
                    let matchCount = 0;
                    
                    items.forEach(item => {
                        const name = item.querySelector('.panel-item-name')?.textContent?.toLowerCase() || '';
                        const meta = item.querySelector('.panel-item-meta')?.textContent?.toLowerCase() || '';
                        const findRegex = item.dataset.scriptId || '';
                        
                        if (!query || name.includes(query) || meta.includes(query) || findRegex.includes(query)) {
                            item.style.display = '';
                            matchCount++;
                        } else {
                            item.style.display = 'none';
                        }
                    });
                    
                    // 검색 결과가 없을 때 메시지 표시
                    const emptyMessage = list.querySelector('.panel-empty');
                    const noResults = list.querySelector('.panel-no-results');
                    
                    if (matchCount === 0 && query) {
                        if (!noResults) {
                            const newNoResults = document.createElement('div');
                            newNoResults.className = 'panel-empty panel-no-results';
                            newNoResults.textContent = '검색 결과가 없습니다';
                            list.appendChild(newNoResults);
                        } else {
                            noResults.style.display = 'block';
                        }
                        if (emptyMessage) {
                            emptyMessage.style.display = 'none';
                        }
                    } else {
                        if (noResults) {
                            noResults.style.display = 'none';
                        }
                        if (emptyMessage && items.length === 0) {
                            emptyMessage.style.display = 'block';
                        }
                    }
                });
            }
        };

        setupSearch('#regex-global-search', '#regex-global-list', 'global');
        setupSearch('#regex-character-search', '#regex-character-list', 'character');

        // 드래그 앤 드롭 순서 변경 (jQuery UI Sortable 사용, 실리태번과 동일)
        const setupSortable = async (listId, scriptType) => {
            if (typeof $ === 'undefined' || !$.fn.sortable) {
                // 경고 코드 토스트 알림 표시
                if (typeof showErrorCodeToast === 'function') {
                    showErrorCodeToast('WARN_PANEL_20002', 'jQuery UI Sortable을 사용할 수 없음');
                }
                return;
            }

            const list = container.querySelector(listId);
            if (!list) return;

            const $list = $(list);
            
            // 모바일 체크 (실리태번과 동일)
            const isMobile = window.innerWidth <= 768;
            const sortableDelay = isMobile ? 150 : 0;

            $list.sortable({
                delay: sortableDelay,
                handle: '.drag-handle',
                items: '.regex-script-item',
                stop: async function () {
                    // RegexScriptStorage - 전역 스코프에서 사용
                    const oldScripts = scriptType === 'global'
                        ? await RegexScriptStorage.loadAll()
                        : await RegexScriptStorage.loadCharacterRegex(await getCurrentCharacterId());
                    
                    // 실리태번과 동일: 순서가 유지된 새 객체 생성 (1928-1934번 라인)
                    const newScripts = {};
                    $(listId).children('.regex-script-item').each(function () {
                        // data-script-id 속성에서 ID 가져오기
                        const scriptId = $(this).attr('data-script-id');
                        if (scriptId && oldScripts[scriptId]) {
                            // 객체에 순서대로 추가 (JavaScript 객체는 삽입 순서 보장, ES2015+)
                            newScripts[scriptId] = oldScripts[scriptId];
                        }
                    });

                    // 실리태번과 동일: 순서 저장 (1936번 라인)
                    if (scriptType === 'global') {
                        await RegexScriptStorage.saveAll(newScripts);
                    } else {
                        const characterId = await getCurrentCharacterId();
                        if (characterId) {
                            await RegexScriptStorage.saveCharacterRegex(characterId, newScripts);
                        }
                    }
                },
            }).disableSelection();
        };

        // 글로벌 및 캐릭터 한정 정규식에 대해 드래그 앤 드롭 설정
        setupSortable('#regex-global-list', 'global');
        setupSortable('#regex-character-list', 'character');
    }

    /**
     * 정규식 편집기 이벤트 설정
     */
    setupRegexEditorEvents(container) {
        // 닫기 버튼 (X 버튼) - 정규식 편집 모달의 경우 정규식 관리 모달로 되돌리기
        const panelContainer = document.getElementById('panel-modal-container');
        const closeBtn = panelContainer?.querySelector('.close-panel-btn');
        if (closeBtn) {
            // 기존 이벤트 리스너 제거 후 새로 추가
            const newCloseBtn = closeBtn.cloneNode(true);
            closeBtn.parentNode.replaceChild(newCloseBtn, closeBtn);
            
            // 새 이벤트 리스너 추가
            const finalCloseBtn = panelContainer.querySelector('.close-panel-btn');
            if (finalCloseBtn) {
                finalCloseBtn.addEventListener('click', async () => {
                    if (panelContainer) {
                        // 정규식 편집 모달인지 확인
                        const isRegexEditor = panelContainer.querySelector('#regex-editor-save');
                        if (isRegexEditor) {
                            // 전환 시작
                            this.isTransitioning = true;
                            
                            // 정규식 관리 패널로 되돌리기 (애니메이션 적용)
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
                            
                            // 정규식 편집 모달에서 characterId 가져오기
                            const modalContent = panelContainer.querySelector('.modal-content');
                            const characterId = modalContent?.dataset?.characterId || null;
                            const currentCharacterId = characterId || (this.callbacks.getCurrentCharacterId ? await this.callbacks.getCurrentCharacterId() : null);
                            const regexHtml = await createRegexPanel(currentCharacterId);
                            panelContainer.classList.remove('closing');
                            panelContainer.innerHTML = regexHtml;
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
                            
                            this.setupRegexPanelEvents(panelContainer);
                            this.setupPanelClickHandler(panelContainer);
                            
                            const regexCloseBtn = panelContainer.querySelector('.close-panel-btn');
                            if (regexCloseBtn) {
                                regexCloseBtn.addEventListener('click', () => this.closePanelModal());
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
                            this.isTransitioning = false;
                        } else {
                            this.closePanelModal();
                        }
                    } else {
                        this.closePanelModal();
                    }
                });
            }
        }
        
        // 편집 중인 스크립트 ID 찾기 (컨테이너에서 가져오기)
        // 빈 문자열도 null로 처리
        const scriptId = container.dataset.scriptId && container.dataset.scriptId.trim() !== '' ? container.dataset.scriptId : null;
        
        // 테스트 모드: 실시간 업데이트
        const testInput = container.querySelector('#regex-test-input');
        const testOutput = container.querySelector('#regex-test-output');
        const findRegexInput = container.querySelector('#regex-find');
        const replaceInput = container.querySelector('#regex-replace');
        
        const updateTest = async () => {
            if (!testInput || !testOutput || !findRegexInput) return;
            
            const testText = testInput.value;
            if (!testText) {
                testOutput.value = '';
                return;
            }
            
            try {
                // 임시 스크립트 생성
                const placementCheckboxes = container.querySelectorAll('input[name="placement"]:checked');
                const placement = Array.from(placementCheckboxes).map(cb => parseInt(cb.value));
                
                const minDepthInput = container.querySelector('#regex-min-depth');
                const maxDepthInput = container.querySelector('#regex-max-depth');
                const substituteRegexSelect = container.querySelector('#regex-substitute-regex');
                
                const minDepth = minDepthInput?.value ? parseInt(minDepthInput.value) : null;
                const maxDepth = maxDepthInput?.value ? parseInt(maxDepthInput.value) : null;
                const substituteRegex = substituteRegexSelect ? parseInt(substituteRegexSelect.value) : 0;
                
                const tempScript = {
                    scriptName: container.querySelector('#regex-script-name')?.value || '',
                    findRegex: findRegexInput.value,
                    replaceString: replaceInput?.value || '',
                    trimStrings: container.querySelector('#regex-trim')?.value.split('\n').filter(s => s.trim()) || [],
                    placement: placement,
                    disabled: container.querySelector('#regex-disabled')?.checked || false,
                    runOnEdit: container.querySelector('#regex-run-on-edit')?.checked || false,
                    markdownOnly: container.querySelector('#regex-markdown-only')?.checked || false,
                    promptOnly: container.querySelector('#regex-prompt-only')?.checked || false,
                    substituteRegex: substituteRegex,
                    minDepth: isNaN(minDepth) ? null : minDepth,
                    maxDepth: isNaN(maxDepth) ? null : maxDepth,
                };
                
                // 정규식 패턴 유효성 검사
                // regexFromString, runRegexScript - 전역 스코프에서 사용
                const testRegex = regexFromString(tempScript.findRegex);
                
                if (!testRegex && tempScript.findRegex) {
                    testOutput.value = `오류: 정규식 패턴이 유효하지 않습니다.\n\n입력된 패턴: ${tempScript.findRegex}\n\n리터럴 문자열을 찾으려면 특수 문자를 이스케이프해야 합니다:\n- 괄호: \\( \\) → \\( \\\\)\n- 파이프: | → \\|\n- 대괄호: [ ] → \\[ \\]\n\n예: <Button>(Get a caste|Start1|Start2)</Button>\n→ <Button>\\(Get a caste\\|Start1\\|Start2\\)</Button>\n\n또는 정규식 형식으로:\n/<Button>\\(Get a caste\\|Start1\\|Start2\\)<\\/Button>/`;
                    return;
                }
                
                if (!testRegex) {
                    testOutput.value = '정규식 패턴이 생성되지 않음';
                    return;
                }
                
                // 디버깅: 패턴이 실제로 매칭되는지 확인 (g 플래그 사용)
                const globalRegex = new RegExp(
                    testRegex.source,
                    testRegex.flags.includes('g') ? testRegex.flags : testRegex.flags + 'g'
                );
                const testMatches = [...testText.matchAll(globalRegex)];
                
                if (testMatches.length === 0) {
                    testOutput.value = '매칭 없음';
                    return;
                }
                
                const result = runRegexScript(tempScript, testText);
                
                // 처리 결과만 표시
                testOutput.value = result || '';
            } catch (e) {
                testOutput.value = `오류: ${e.message}\n\n스택:\n${e.stack}`;
            }
        };
        
        // 테스트 업데이트를 위한 이벤트 리스너
        const trimInput = container.querySelector('#regex-trim');
        
        if (testInput) {
            testInput.addEventListener('input', updateTest);
        }
        if (findRegexInput) {
            findRegexInput.addEventListener('input', updateTest);
        }
        if (replaceInput) {
            replaceInput.addEventListener('input', updateTest);
        }
        if (trimInput) {
            trimInput.addEventListener('input', updateTest);
        }
        
        // 저장 버튼
        const saveBtn = container.querySelector('#regex-editor-save');
        if (saveBtn) {
            saveBtn.addEventListener('click', async () => {
                const scriptName = container.querySelector('#regex-script-name')?.value.trim();
                if (!scriptName) {
                    showToast('스크립트 이름을 입력해주세요.', 'warning');
                    return;
                }
                
                const findRegex = findRegexInput?.value.trim();
                if (!findRegex) {
                    showToast('Find Regex를 입력해주세요.', 'warning');
                    return;
                }
                
                const placementCheckboxes = container.querySelectorAll('input[name="placement"]:checked');
                const placement = Array.from(placementCheckboxes).map(cb => parseInt(cb.value));
                
                if (placement.length === 0) {
                    showToast('최소 하나의 적용 위치를 선택해주세요.', 'warning');
                    return;
                }
                
                const trimText = container.querySelector('#regex-trim')?.value || '';
                const trimStrings = trimText.split('\n').filter(s => s.trim());
                
                const minDepthInput = container.querySelector('#regex-min-depth');
                const maxDepthInput = container.querySelector('#regex-max-depth');
                const substituteRegexSelect = container.querySelector('#regex-substitute-regex');
                
                const minDepth = minDepthInput?.value ? parseInt(minDepthInput.value) : null;
                const maxDepth = maxDepthInput?.value ? parseInt(maxDepthInput.value) : null;
                const substituteRegex = substituteRegexSelect ? parseInt(substituteRegexSelect.value) : 0;
                
                const scriptData = {
                    scriptName: scriptName,
                    findRegex: findRegex,
                    replaceString: replaceInput?.value || '',
                    trimStrings: trimStrings,
                    placement: placement,
                    disabled: container.querySelector('#regex-disabled')?.checked || false,
                    runOnEdit: container.querySelector('#regex-run-on-edit')?.checked || false,
                    markdownOnly: container.querySelector('#regex-markdown-only')?.checked || false,
                    promptOnly: container.querySelector('#regex-prompt-only')?.checked || false,
                    substituteRegex: substituteRegex,
                    minDepth: isNaN(minDepth) ? null : minDepth,
                    maxDepth: isNaN(maxDepth) ? null : maxDepth,
                };
                
                // RegexScriptStorage - 전역 스코프에서 사용
                const uuid = () => {
                    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
                        const r = Math.random() * 16 | 0;
                        const v = c === 'x' ? r : (r & 0x3 | 0x8);
                        return v.toString(16);
                    });
                };
                
                // 스크립트 타입과 캐릭터 ID 가져오기
                const scriptType = container.dataset.scriptType || 'global';
                // characterId가 빈 문자열이거나 null이면 null로 처리
                const characterId = (container.dataset.characterId && container.dataset.characterId.trim() !== '') 
                    ? container.dataset.characterId 
                    : null;
                
                // 편집 모드인 경우 scriptId 사용, 아니면 새 UUID 생성
                let id = scriptId;
                if (!id || id.trim() === '') {
                    id = uuid();
                }
                
                // 저장
                if (scriptType === 'character' && characterId) {
                    await RegexScriptStorage.saveCharacterRegexScript(characterId, id, scriptData);
                } else {
                    await RegexScriptStorage.save(id, scriptData);
                }
                
                // 정규식 관리 모달로 돌아가기
                const panelContainer = document.getElementById('panel-modal-container');
                if (panelContainer) {
                    // 정규식 편집 모달인지 확인
                    const isRegexEditor = panelContainer.querySelector('#regex-editor-save');
                    if (isRegexEditor) {
                        // 전환 시작
                        this.isTransitioning = true;
                        
                        // 정규식 관리 패널로 되돌리기 (애니메이션 적용)
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
                        
                        const currentCharacterId = characterId || (this.callbacks.getCurrentCharacterId ? await this.callbacks.getCurrentCharacterId() : null);
                        const regexHtml = await createRegexPanel(currentCharacterId);
                        panelContainer.classList.remove('closing');
                        panelContainer.innerHTML = regexHtml;
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
                        
                        this.setupRegexPanelEvents(panelContainer);
                        this.setupPanelClickHandler(panelContainer);
                        
                        const regexCloseBtn = panelContainer.querySelector('.close-panel-btn');
                        if (regexCloseBtn) {
                            regexCloseBtn.addEventListener('click', () => this.closePanelModal());
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
                        this.isTransitioning = false;
                    } else {
                        // 정규식 편집 모달이 아니면 새로 열기
                        const currentCharacterId = characterId || (this.callbacks.getCurrentCharacterId ? await this.callbacks.getCurrentCharacterId() : null);
                        const panelHtml = await createRegexPanel(currentCharacterId);
                        this.openPanelModal(panelHtml, 'regex');
                    }
                } else {
                    // 패널이 없으면 새로 열기
                    const currentCharacterId = characterId || (this.callbacks.getCurrentCharacterId ? await this.callbacks.getCurrentCharacterId() : null);
                    const panelHtml = await createRegexPanel(currentCharacterId);
                    this.openPanelModal(panelHtml, 'regex');
                }
            });
        }
        
        // 취소 버튼
        const cancelBtn = container.querySelector('#regex-editor-cancel');
        if (cancelBtn) {
            cancelBtn.addEventListener('click', async () => {
                // 정규식 관리 모달로 돌아가기
                const panelContainer = document.getElementById('panel-modal-container');
                if (panelContainer) {
                    // 정규식 편집 모달인지 확인
                    const isRegexEditor = panelContainer.querySelector('#regex-editor-save');
                    if (isRegexEditor) {
                        // 전환 시작
                        this.isTransitioning = true;
                        
                        // 정규식 관리 패널로 되돌리기 (애니메이션 적용)
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
                        
                        const characterId = container.dataset.characterId || null;
                        const currentCharacterId = characterId || (this.callbacks.getCurrentCharacterId ? await this.callbacks.getCurrentCharacterId() : null);
                        const regexHtml = await createRegexPanel(currentCharacterId);
                        panelContainer.classList.remove('closing');
                        panelContainer.innerHTML = regexHtml;
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
                        
                        this.setupRegexPanelEvents(panelContainer);
                        this.setupPanelClickHandler(panelContainer);
                        
                        const regexCloseBtn = panelContainer.querySelector('.close-panel-btn');
                        if (regexCloseBtn) {
                            regexCloseBtn.addEventListener('click', () => this.closePanelModal());
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
                        this.isTransitioning = false;
                    } else {
                        // 정규식 편집 모달이 아니면 새로 열기
                        const characterId = container.dataset.characterId || null;
                        const currentCharacterId = characterId || (this.callbacks.getCurrentCharacterId ? await this.callbacks.getCurrentCharacterId() : null);
                        const panelHtml = await createRegexPanel(currentCharacterId);
                        this.openPanelModal(panelHtml, 'regex');
                    }
                } else {
                    // 패널이 없으면 새로 열기
                    const characterId = container.dataset.characterId || null;
                    const currentCharacterId = characterId || (this.callbacks.getCurrentCharacterId ? await this.callbacks.getCurrentCharacterId() : null);
                    const panelHtml = await createRegexPanel(currentCharacterId);
                    this.openPanelModal(panelHtml, 'regex');
                }
            });
        }
    }

    /**
     * 상태창/선택지 패널 이벤트 설정
     */
    async setupStatusBarChoicePanelEvents(container) {
        // SettingsStorage - 전역 스코프에서 사용
        
        // 탭 전환 이벤트
        const tabButtons = container.querySelectorAll('.regex-tab-btn[data-tab]');
        const tabContents = container.querySelectorAll('.regex-tab-content');

        tabButtons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                const tab = btn.dataset.tab;

                // 탭 버튼 활성화 상태 변경
                tabButtons.forEach(b => {
                    b.classList.remove('active');
                    b.style.setProperty('border-bottom', '2px solid transparent', 'important');
                });
                btn.classList.add('active');
                btn.style.setProperty('border-bottom', '2px solid var(--accent-green)', 'important');

                // 탭 콘텐츠 표시/숨김
                tabContents.forEach(content => {
                    content.style.display = 'none';
                });

                const targetTab = container.querySelector(`#status-bar-choice-${tab}-tab`);
                if (targetTab) {
                    targetTab.style.display = 'block';
                }
            });
        });

        // 상태창 토글 이벤트
        const statusBarToggle = container.querySelector('#status-bar-toggle');
        if (statusBarToggle) {
            statusBarToggle.addEventListener('change', async (e) => {
                const enabled = e.target.checked;
                const settings = await SettingsStorage.load();
                settings.statusBarEnabled = enabled;
                await SettingsStorage.save(settings);
            });
        }

        // 상태창 프리셋 선택 이벤트
        const statusBarPresetSelect = container.querySelector('#status-bar-preset-select');
        if (statusBarPresetSelect) {
            statusBarPresetSelect.addEventListener('change', async (e) => {
                const presetId = e.target.value;
                const settings = await SettingsStorage.load();
                
                if (presetId && settings.statusBarPresets && settings.statusBarPresets[presetId]) {
                    // 프리셋 값 로드
                    const preset = settings.statusBarPresets[presetId];
                    settings.statusBarPresetId = presetId;
                    settings.statusBarPosition = preset.position ?? 4;
                    settings.statusBarRole = preset.role ?? 0;
                    settings.statusBarDepth = preset.depth ?? 1;
                    settings.statusBarOrder = preset.order ?? 250;
                    settings.statusBarInstruction = preset.instruction || '';
                    
                    // UI 업데이트
                    const positionSelect = container.querySelector('#status-bar-position-select');
                    const depthInput = container.querySelector('#status-bar-depth-input');
                    const orderInput = container.querySelector('#status-bar-order-input');
                    const instructionTextarea = container.querySelector('#status-bar-instruction-textarea');
                    
                    if (positionSelect) {
                        // position과 role이 모두 일치하는 option 찾기
                        const options = Array.from(positionSelect.options);
                        const matchingOption = options.find(opt => {
                            const optPosition = Number(opt.value);
                            const optRole = opt.dataset.role !== '' && opt.dataset.role !== undefined 
                                ? Number(opt.dataset.role) : null;
                            const presetRole = settings.statusBarRole ?? 0;
                            
                            if (optPosition === settings.statusBarPosition) {
                                if (optPosition === 4) {
                                    // atDepth인 경우 role도 일치해야 함
                                    return optRole === presetRole;
                                } else {
                                    // atDepth가 아닌 경우 role이 null이어야 함
                                    return optRole === null;
                                }
                            }
                            return false;
                        });
                        
                        if (matchingOption) {
                            positionSelect.value = matchingOption.value;
                            matchingOption.selected = true;
                        } else {
                            positionSelect.value = settings.statusBarPosition;
                        }
                        
                        // Depth 필드 표시/숨김
                        if (positionSelect.value === '4') {
                            if (depthInput) {
                                depthInput.style.visibility = 'visible';
                                depthInput.disabled = false;
                            }
                        } else {
                            if (depthInput) {
                                depthInput.style.visibility = 'hidden';
                                depthInput.disabled = true;
                            }
                        }
                    }
                    
                    if (depthInput && settings.statusBarPosition === 4) {
                        depthInput.value = settings.statusBarDepth;
                    }
                    
                    if (orderInput) {
                        orderInput.value = settings.statusBarOrder;
                    }
                    
                    if (instructionTextarea) {
                        instructionTextarea.value = settings.statusBarInstruction;
                    }
                } else {
                    settings.statusBarPresetId = presetId || null;
                }
                
                await SettingsStorage.save(settings);
            });
        }

        // 선택지 토글 이벤트
        const choiceToggle = container.querySelector('#choice-toggle');
        if (choiceToggle) {
            choiceToggle.addEventListener('change', async (e) => {
                const enabled = e.target.checked;
                const settings = await SettingsStorage.load();
                settings.choiceEnabled = enabled;
                await SettingsStorage.save(settings);
            });
        }

        // 선택지 프리셋 선택 이벤트
        const choicePresetSelect = container.querySelector('#choice-preset-select');
        if (choicePresetSelect) {
            choicePresetSelect.addEventListener('change', async (e) => {
                const presetId = e.target.value;
                const settings = await SettingsStorage.load();
                
                if (presetId && settings.choicePresets && settings.choicePresets[presetId]) {
                    // 프리셋 값 로드
                    const preset = settings.choicePresets[presetId];
                    settings.choicePresetId = presetId;
                    settings.choicePosition = preset.position ?? 4;
                    settings.choiceRole = preset.role ?? 0;
                    settings.choiceDepth = preset.depth ?? 1;
                    settings.choiceOrder = preset.order ?? 250;
                    settings.choiceInstruction = preset.instruction || '';
                    
                    // UI 업데이트
                    const positionSelect = container.querySelector('#choice-position-select');
                    const depthInput = container.querySelector('#choice-depth-input');
                    const orderInput = container.querySelector('#choice-order-input');
                    const instructionTextarea = container.querySelector('#choice-instruction-textarea');
                    
                    if (positionSelect) {
                        // position과 role이 모두 일치하는 option 찾기
                        const options = Array.from(positionSelect.options);
                        const matchingOption = options.find(opt => {
                            const optPosition = Number(opt.value);
                            const optRole = opt.dataset.role !== '' && opt.dataset.role !== undefined 
                                ? Number(opt.dataset.role) : null;
                            const presetRole = settings.choiceRole ?? 0;
                            
                            if (optPosition === settings.choicePosition) {
                                if (optPosition === 4) {
                                    // atDepth인 경우 role도 일치해야 함
                                    return optRole === presetRole;
                                } else {
                                    // atDepth가 아닌 경우 role이 null이어야 함
                                    return optRole === null;
                                }
                            }
                            return false;
                        });
                        
                        if (matchingOption) {
                            positionSelect.value = matchingOption.value;
                            matchingOption.selected = true;
                        } else {
                            positionSelect.value = settings.choicePosition;
                        }
                        
                        // Depth 필드 표시/숨김
                        if (positionSelect.value === '4') {
                            if (depthInput) {
                                depthInput.style.visibility = 'visible';
                                depthInput.disabled = false;
                            }
                        } else {
                            if (depthInput) {
                                depthInput.style.visibility = 'hidden';
                                depthInput.disabled = true;
                            }
                        }
                    }
                    
                    if (depthInput && settings.choicePosition === 4) {
                        depthInput.value = settings.choiceDepth;
                    }
                    
                    if (orderInput) {
                        orderInput.value = settings.choiceOrder;
                    }
                    
                    if (instructionTextarea) {
                        instructionTextarea.value = settings.choiceInstruction;
                    }
                } else {
                    settings.choicePresetId = presetId || null;
                }
                
                await SettingsStorage.save(settings);
            });
        }

        // 상태창 Position 선택 이벤트
        const statusBarPositionSelect = container.querySelector('#status-bar-position-select');
        if (statusBarPositionSelect) {
            statusBarPositionSelect.addEventListener('change', async (e) => {
                const selectedOption = e.target.options[e.target.selectedIndex];
                const position = Number(e.target.value);
                const role = selectedOption.dataset.role !== '' && selectedOption.dataset.role !== undefined 
                    ? Number(selectedOption.dataset.role) : null;
                const settings = await SettingsStorage.load();
                settings.statusBarPosition = position;
                settings.statusBarRole = role !== null ? role : 0; // 기본값: 0 (SYSTEM)
                
                // atDepth (4)가 아니면 depth 필드 숨김
                const depthInput = container.querySelector('#status-bar-depth-input');
                if (depthInput) {
                    if (position === 4) {
                        depthInput.style.visibility = 'visible';
                        depthInput.disabled = false;
                    } else {
                        depthInput.style.visibility = 'hidden';
                        depthInput.disabled = true;
                    }
                }
                
                await SettingsStorage.save(settings);
            });
        }

        // 상태창 Depth 입력 이벤트
        const statusBarDepthInput = container.querySelector('#status-bar-depth-input');
        if (statusBarDepthInput) {
            statusBarDepthInput.addEventListener('change', async (e) => {
                const depth = Number(e.target.value) || 1;
                const settings = await SettingsStorage.load();
                settings.statusBarDepth = depth;
                await SettingsStorage.save(settings);
            });
        }

        // 상태창 Order 입력 이벤트
        const statusBarOrderInput = container.querySelector('#status-bar-order-input');
        if (statusBarOrderInput) {
            statusBarOrderInput.addEventListener('change', async (e) => {
                const order = Number(e.target.value) || 250;
                const settings = await SettingsStorage.load();
                settings.statusBarOrder = order;
                await SettingsStorage.save(settings);
            });
        }

        // 선택지 Position 선택 이벤트
        const choicePositionSelect = container.querySelector('#choice-position-select');
        if (choicePositionSelect) {
            choicePositionSelect.addEventListener('change', async (e) => {
                const selectedOption = e.target.options[e.target.selectedIndex];
                const position = Number(e.target.value);
                const role = selectedOption.dataset.role !== '' && selectedOption.dataset.role !== undefined 
                    ? Number(selectedOption.dataset.role) : null;
                const settings = await SettingsStorage.load();
                settings.choicePosition = position;
                settings.choiceRole = role !== null ? role : 0; // 기본값: 0 (SYSTEM)
                
                // atDepth (4)가 아니면 depth 필드 숨김
                const depthInput = container.querySelector('#choice-depth-input');
                if (depthInput) {
                    if (position === 4) {
                        depthInput.style.visibility = 'visible';
                        depthInput.disabled = false;
                    } else {
                        depthInput.style.visibility = 'hidden';
                        depthInput.disabled = true;
                    }
                }
                
                await SettingsStorage.save(settings);
            });
        }

        // 선택지 Depth 입력 이벤트
        const choiceDepthInput = container.querySelector('#choice-depth-input');
        if (choiceDepthInput) {
            choiceDepthInput.addEventListener('change', async (e) => {
                const depth = Number(e.target.value) || 1;
                const settings = await SettingsStorage.load();
                settings.choiceDepth = depth;
                await SettingsStorage.save(settings);
            });
        }

        // 선택지 Order 입력 이벤트
        const choiceOrderInput = container.querySelector('#choice-order-input');
        if (choiceOrderInput) {
            choiceOrderInput.addEventListener('change', async (e) => {
                const order = Number(e.target.value) || 250;
                const settings = await SettingsStorage.load();
                settings.choiceOrder = order;
                await SettingsStorage.save(settings);
            });
        }

        // 상태창 지시문 입력 이벤트
        const statusBarInstructionTextarea = container.querySelector('#status-bar-instruction-textarea');
        if (statusBarInstructionTextarea) {
            statusBarInstructionTextarea.addEventListener('input', async (e) => {
                const instruction = e.target.value;
                const settings = await SettingsStorage.load();
                settings.statusBarInstruction = instruction;
                await SettingsStorage.save(settings);
            });
        }

        // 선택지 지시문 입력 이벤트
        const choiceInstructionTextarea = container.querySelector('#choice-instruction-textarea');
        if (choiceInstructionTextarea) {
            choiceInstructionTextarea.addEventListener('input', async (e) => {
                const instruction = e.target.value;
                const settings = await SettingsStorage.load();
                settings.choiceInstruction = instruction;
                await SettingsStorage.save(settings);
            });
        }

        // 상태창 프리셋 기능들
        await this.setupStatusBarPresetActions(container);
        
        // 선택지 프리셋 기능들
        await this.setupChoicePresetActions(container);
    }

    /**
     * 상태창 프리셋 액션 설정
     */
    async setupStatusBarPresetActions(container) {
        // SettingsStorage - 전역 스코프에서 사용
        
        // UUID 생성 함수
        const uuid = () => {
            return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
                const r = Math.random() * 16 | 0;
                const v = c === 'x' ? r : (r & 0x3 | 0x8);
                return v.toString(16);
            });
        };

        // 추가 버튼
        const addBtn = container.querySelector('#status-bar-add-btn');
        if (addBtn) {
            addBtn.addEventListener('click', async () => {
                const positionSelect = container.querySelector('#status-bar-position-select');
                const depthInput = container.querySelector('#status-bar-depth-input');
                const orderInput = container.querySelector('#status-bar-order-input');
                const instructionTextarea = container.querySelector('#status-bar-instruction-textarea');
                
                if (!positionSelect || !orderInput || !instructionTextarea) {
                    showToast('입력 칸을 찾을 수 없습니다.', 'error');
                    return;
                }
                
                const selectedOption = positionSelect.options[positionSelect.selectedIndex];
                const position = Number(positionSelect.value);
                const role = selectedOption && selectedOption.dataset.role !== '' && selectedOption.dataset.role !== undefined 
                    ? Number(selectedOption.dataset.role) : null;
                const depth = position === 4 ? (Number(depthInput?.value) || 1) : 0;
                const order = Number(orderInput.value) || 250;
                const instruction = instructionTextarea.value.trim();
                
                // 프리셋 이름 입력 받기
                const presetName = await showInputModal('프리셋 이름을 입력하세요:', '프리셋 이름');
                if (!presetName || !presetName.trim()) {
                    return;
                }
                
                const presetId = uuid();
                const settings = await SettingsStorage.load();
                
                if (!settings.statusBarPresets) {
                    settings.statusBarPresets = {};
                }
                
                // 프리셋 저장
                settings.statusBarPresets[presetId] = {
                    name: presetName.trim(),
                    position: position,
                    role: role !== null ? role : 0,
                    depth: depth,
                    order: order,
                    instruction: instruction
                };
                
                // 현재 선택된 프리셋으로 설정
                settings.statusBarPresetId = presetId;
                
                await SettingsStorage.save(settings);
                
                // 패널 새로고침
                // createStatusBarChoicePanel - 전역 스코프에서 사용
                const newPanelHtml = await createStatusBarChoicePanel();
                const modalContent = container.querySelector('.modal-content');
                if (modalContent) {
                    modalContent.innerHTML = newPanelHtml;
                    await this.setupStatusBarChoicePanelEvents(container);
                    const closeBtn = container.querySelector('.close-panel-btn');
                    if (closeBtn) {
                        closeBtn.addEventListener('click', () => this.closePanelModal());
                    }
                }
            });
        }

        // 이름 편집 버튼
        const editNameBtn = container.querySelector('#status-bar-edit-name-btn');
        if (editNameBtn) {
            editNameBtn.addEventListener('click', async () => {
                const presetSelect = container.querySelector('#status-bar-preset-select');
                if (!presetSelect || !presetSelect.value) {
                    showToast('편집할 프리셋을 선택해주세요.', 'warning');
                    return;
                }
                
                const presetId = presetSelect.value;
                const settings = await SettingsStorage.load();
                
                if (!settings.statusBarPresets || !settings.statusBarPresets[presetId]) {
                    showToast('선택된 프리셋을 찾을 수 없습니다.', 'error');
                    return;
                }
                
                const preset = settings.statusBarPresets[presetId];
                const newName = await showInputModal('새 프리셋 이름을 입력하세요:', '프리셋 이름 변경', preset.name);
                
                if (!newName || !newName.trim()) {
                    return;
                }
                
                preset.name = newName.trim();
                await SettingsStorage.save(settings);
                
                // 패널 새로고침
                // createStatusBarChoicePanel - 전역 스코프에서 사용
                const newPanelHtml = await createStatusBarChoicePanel();
                const modalContent = container.querySelector('.modal-content');
                if (modalContent) {
                    modalContent.innerHTML = newPanelHtml;
                    await this.setupStatusBarChoicePanelEvents(container);
                    const closeBtn = container.querySelector('.close-panel-btn');
                    if (closeBtn) {
                        closeBtn.addEventListener('click', () => this.closePanelModal());
                    }
                }
            });
        }

        // 저장 버튼
        const saveBtn = container.querySelector('#status-bar-save-btn');
        if (saveBtn) {
            saveBtn.addEventListener('click', async () => {
                const presetSelect = container.querySelector('#status-bar-preset-select');
                const positionSelect = container.querySelector('#status-bar-position-select');
                const depthInput = container.querySelector('#status-bar-depth-input');
                const orderInput = container.querySelector('#status-bar-order-input');
                const instructionTextarea = container.querySelector('#status-bar-instruction-textarea');
                
                if (!presetSelect || !presetSelect.value) {
                    showToast('저장할 프리셋을 선택해주세요. 프리셋이 없으면 "추가" 버튼을 사용하여 새로 만드세요.', 'warning');
                    return;
                }
                
                const presetId = presetSelect.value;
                const settings = await SettingsStorage.load();
                
                if (!settings.statusBarPresets || !settings.statusBarPresets[presetId]) {
                    showToast('선택된 프리셋을 찾을 수 없습니다.', 'error');
                    return;
                }
                
                const selectedOption = positionSelect?.options[positionSelect.selectedIndex];
                const position = Number(positionSelect?.value) ?? 4;
                const role = selectedOption && selectedOption.dataset.role !== '' && selectedOption.dataset.role !== undefined 
                    ? Number(selectedOption.dataset.role) : null;
                const depth = position === 4 ? (Number(depthInput?.value) || 1) : 0;
                const order = Number(orderInput?.value) || 250;
                const instruction = instructionTextarea?.value.trim() || '';
                
                // 프리셋 업데이트
                settings.statusBarPresets[presetId] = {
                    name: settings.statusBarPresets[presetId].name,
                    position: position,
                    role: role !== null ? role : 0,
                    depth: depth,
                    order: order,
                    instruction: instruction
                };
                
                await SettingsStorage.save(settings);
                showToast(`프리셋 "${settings.statusBarPresets[presetId].name}"이(가) 저장되었습니다.`, 'success');
            });
        }

        // 내보내기 버튼
        const exportBtn = container.querySelector('#status-bar-export-btn');
        if (exportBtn) {
            exportBtn.addEventListener('click', async () => {
                const presetSelect = container.querySelector('#status-bar-preset-select');
                const presetId = presetSelect?.value || null;
                const settings = await SettingsStorage.load();
                
                let presetsToExport = [];
                
                if (presetId && settings.statusBarPresets && settings.statusBarPresets[presetId]) {
                    // 단일 프리셋 내보내기
                    presetsToExport = [settings.statusBarPresets[presetId]];
                } else if (settings.statusBarPresets) {
                    // 모든 프리셋 내보내기
                    presetsToExport = Object.values(settings.statusBarPresets);
                }
                
                if (presetsToExport.length === 0) {
                    showToast('내보낼 프리셋이 없습니다.', 'warning');
                    return;
                }
                
                const dataStr = JSON.stringify(presetsToExport.length === 1 ? presetsToExport[0] : presetsToExport, null, 2);
                const dataBlob = new Blob([dataStr], { type: 'application/json' });
                const url = URL.createObjectURL(dataBlob);
                const link = document.createElement('a');
                link.href = url;
                link.download = presetId ? `${settings.statusBarPresets[presetId].name || 'status-bar-preset'}.json` : 'status-bar-presets.json';
                link.click();
                URL.revokeObjectURL(url);
            });
        }

        // 불러오기 버튼
        const importBtn = container.querySelector('#status-bar-import-btn');
        if (importBtn) {
            let fileInput = document.getElementById('import-status-bar-preset-input');
            
            if (!fileInput) {
                fileInput = document.createElement('input');
                fileInput.type = 'file';
                fileInput.id = 'import-status-bar-preset-input';
                fileInput.style.display = 'none';
                fileInput.accept = '.json';
                fileInput.multiple = false;
                document.body.appendChild(fileInput);
                
                fileInput.addEventListener('change', async (e) => {
                    const file = e.target.files[0];
                    if (!file) return;
                    
                    try {
                        const text = await file.text();
                        const data = JSON.parse(text);
                        const settings = await SettingsStorage.load();
                        
                        if (!settings.statusBarPresets) {
                            settings.statusBarPresets = {};
                        }
                        
                        const presetsArray = Array.isArray(data) ? data : [data];
                        let importedCount = 0;
                        
                        for (const preset of presetsArray) {
                            if (!preset.name) continue;
                            
                            const newPresetId = uuid();
                            settings.statusBarPresets[newPresetId] = {
                                name: preset.name,
                                position: preset.position ?? 4,
                                role: preset.role ?? 0,
                                depth: preset.depth ?? 1,
                                order: preset.order ?? 250,
                                instruction: preset.instruction || ''
                            };
                            importedCount++;
                        }
                        
                        await SettingsStorage.save(settings);
                        
                        // 패널 새로고침
                        // createStatusBarChoicePanel - 전역 스코프에서 사용
                        const newPanelHtml = await createStatusBarChoicePanel();
                        const modalContent = container.querySelector('.modal-content');
                        if (modalContent) {
                            modalContent.innerHTML = newPanelHtml;
                            await this.setupStatusBarChoicePanelEvents(container);
                            const closeBtn = container.querySelector('.close-panel-btn');
                            if (closeBtn) {
                                closeBtn.addEventListener('click', () => this.closePanelModal());
                            }
                        }
                        
                        showToast(`프리셋 불러오기 성공! 파일: ${file.name}, 불러온 프리셋: ${importedCount}개`, 'success');
                    } catch (error) {
                        // 오류 코드 토스트 알림 표시
                        if (typeof showErrorCodeToast === 'function') {
                            showErrorCodeToast('ERR_PANEL_7010', '상태창/선택지 패널 프리셋 불러오기 오류', error);
                        } else if (typeof showToast === 'function') {
                            showToast(`프리셋 불러오기 실패: ${error.message}`, 'error');
                        }
                    }
                    
                    e.target.value = '';
                });
            }
            
            importBtn.addEventListener('click', () => {
                fileInput.click();
            });
        }
    }

    /**
     * 선택지 프리셋 액션 설정
     */
    async setupChoicePresetActions(container) {
        // SettingsStorage - 전역 스코프에서 사용
        
        // UUID 생성 함수
        const uuid = () => {
            return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
                const r = Math.random() * 16 | 0;
                const v = c === 'x' ? r : (r & 0x3 | 0x8);
                return v.toString(16);
            });
        };

        // 추가 버튼
        const addBtn = container.querySelector('#choice-add-btn');
        if (addBtn) {
            addBtn.addEventListener('click', async () => {
                const positionSelect = container.querySelector('#choice-position-select');
                const depthInput = container.querySelector('#choice-depth-input');
                const orderInput = container.querySelector('#choice-order-input');
                const instructionTextarea = container.querySelector('#choice-instruction-textarea');
                
                if (!positionSelect || !orderInput || !instructionTextarea) {
                    showToast('입력 칸을 찾을 수 없습니다.', 'error');
                    return;
                }
                
                const selectedOption = positionSelect.options[positionSelect.selectedIndex];
                const position = Number(positionSelect.value);
                const role = selectedOption && selectedOption.dataset.role !== '' && selectedOption.dataset.role !== undefined 
                    ? Number(selectedOption.dataset.role) : null;
                const depth = position === 4 ? (Number(depthInput?.value) || 1) : 0;
                const order = Number(orderInput.value) || 250;
                const instruction = instructionTextarea.value.trim();
                
                // 프리셋 이름 입력 받기
                const presetName = await showInputModal('프리셋 이름을 입력하세요:', '프리셋 이름');
                if (!presetName || !presetName.trim()) {
                    return;
                }
                
                const presetId = uuid();
                const settings = await SettingsStorage.load();
                
                if (!settings.choicePresets) {
                    settings.choicePresets = {};
                }
                
                // 프리셋 저장
                settings.choicePresets[presetId] = {
                    name: presetName.trim(),
                    position: position,
                    role: role !== null ? role : 0,
                    depth: depth,
                    order: order,
                    instruction: instruction
                };
                
                // 현재 선택된 프리셋으로 설정
                settings.choicePresetId = presetId;
                
                await SettingsStorage.save(settings);
                
                // 패널 새로고침
                // createStatusBarChoicePanel - 전역 스코프에서 사용
                const newPanelHtml = await createStatusBarChoicePanel();
                const modalContent = container.querySelector('.modal-content');
                if (modalContent) {
                    modalContent.innerHTML = newPanelHtml;
                    await this.setupStatusBarChoicePanelEvents(container);
                    const closeBtn = container.querySelector('.close-panel-btn');
                    if (closeBtn) {
                        closeBtn.addEventListener('click', () => this.closePanelModal());
                    }
                }
            });
        }

        // 이름 편집 버튼
        const editNameBtn = container.querySelector('#choice-edit-name-btn');
        if (editNameBtn) {
            editNameBtn.addEventListener('click', async () => {
                const presetSelect = container.querySelector('#choice-preset-select');
                if (!presetSelect || !presetSelect.value) {
                    showToast('편집할 프리셋을 선택해주세요.', 'warning');
                    return;
                }
                
                const presetId = presetSelect.value;
                const settings = await SettingsStorage.load();
                
                if (!settings.choicePresets || !settings.choicePresets[presetId]) {
                    showToast('선택된 프리셋을 찾을 수 없습니다.', 'error');
                    return;
                }
                
                const preset = settings.choicePresets[presetId];
                const newName = await showInputModal('새 프리셋 이름을 입력하세요:', '프리셋 이름 변경', preset.name);
                
                if (!newName || !newName.trim()) {
                    return;
                }
                
                preset.name = newName.trim();
                await SettingsStorage.save(settings);
                
                // 패널 새로고침
                // createStatusBarChoicePanel - 전역 스코프에서 사용
                const newPanelHtml = await createStatusBarChoicePanel();
                const modalContent = container.querySelector('.modal-content');
                if (modalContent) {
                    modalContent.innerHTML = newPanelHtml;
                    await this.setupStatusBarChoicePanelEvents(container);
                    const closeBtn = container.querySelector('.close-panel-btn');
                    if (closeBtn) {
                        closeBtn.addEventListener('click', () => this.closePanelModal());
                    }
                }
            });
        }

        // 저장 버튼
        const saveBtn = container.querySelector('#choice-save-btn');
        if (saveBtn) {
            saveBtn.addEventListener('click', async () => {
                const presetSelect = container.querySelector('#choice-preset-select');
                const positionSelect = container.querySelector('#choice-position-select');
                const depthInput = container.querySelector('#choice-depth-input');
                const orderInput = container.querySelector('#choice-order-input');
                const instructionTextarea = container.querySelector('#choice-instruction-textarea');
                
                if (!presetSelect || !presetSelect.value) {
                    showToast('저장할 프리셋을 선택해주세요. 프리셋이 없으면 "추가" 버튼을 사용하여 새로 만드세요.', 'warning');
                    return;
                }
                
                const presetId = presetSelect.value;
                const settings = await SettingsStorage.load();
                
                if (!settings.choicePresets || !settings.choicePresets[presetId]) {
                    showToast('선택된 프리셋을 찾을 수 없습니다.', 'error');
                    return;
                }
                
                const selectedOption = positionSelect?.options[positionSelect.selectedIndex];
                const position = Number(positionSelect?.value) ?? 4;
                const role = selectedOption && selectedOption.dataset.role !== '' && selectedOption.dataset.role !== undefined 
                    ? Number(selectedOption.dataset.role) : null;
                const depth = position === 4 ? (Number(depthInput?.value) || 1) : 0;
                const order = Number(orderInput?.value) || 250;
                const instruction = instructionTextarea?.value.trim() || '';
                
                // 프리셋 업데이트
                settings.choicePresets[presetId] = {
                    name: settings.choicePresets[presetId].name,
                    position: position,
                    role: role !== null ? role : 0,
                    depth: depth,
                    order: order,
                    instruction: instruction
                };
                
                await SettingsStorage.save(settings);
                showToast(`프리셋 "${settings.choicePresets[presetId].name}"이(가) 저장되었습니다.`, 'success');
            });
        }

        // 내보내기 버튼
        const exportBtn = container.querySelector('#choice-export-btn');
        if (exportBtn) {
            exportBtn.addEventListener('click', async () => {
                const presetSelect = container.querySelector('#choice-preset-select');
                const presetId = presetSelect?.value || null;
                const settings = await SettingsStorage.load();
                
                let presetsToExport = [];
                
                if (presetId && settings.choicePresets && settings.choicePresets[presetId]) {
                    presetsToExport = [settings.choicePresets[presetId]];
                } else if (settings.choicePresets) {
                    presetsToExport = Object.values(settings.choicePresets);
                }
                
                if (presetsToExport.length === 0) {
                    showToast('내보낼 프리셋이 없습니다.', 'warning');
                    return;
                }
                
                const dataStr = JSON.stringify(presetsToExport.length === 1 ? presetsToExport[0] : presetsToExport, null, 2);
                const dataBlob = new Blob([dataStr], { type: 'application/json' });
                const url = URL.createObjectURL(dataBlob);
                const link = document.createElement('a');
                link.href = url;
                link.download = presetId ? `${settings.choicePresets[presetId].name || 'choice-preset'}.json` : 'choice-presets.json';
                link.click();
                URL.revokeObjectURL(url);
            });
        }

        // 불러오기 버튼
        const importBtn = container.querySelector('#choice-import-btn');
        if (importBtn) {
            let fileInput = document.getElementById('import-choice-preset-input');
            
            if (!fileInput) {
                fileInput = document.createElement('input');
                fileInput.type = 'file';
                fileInput.id = 'import-choice-preset-input';
                fileInput.style.display = 'none';
                fileInput.accept = '.json';
                fileInput.multiple = false;
                document.body.appendChild(fileInput);
                
                fileInput.addEventListener('change', async (e) => {
                    const file = e.target.files[0];
                    if (!file) return;
                    
                    try {
                        const text = await file.text();
                        const data = JSON.parse(text);
                        const settings = await SettingsStorage.load();
                        
                        if (!settings.choicePresets) {
                            settings.choicePresets = {};
                        }
                        
                        const presetsArray = Array.isArray(data) ? data : [data];
                        let importedCount = 0;
                        
                        for (const preset of presetsArray) {
                            if (!preset.name) continue;
                            
                            const newPresetId = uuid();
                            settings.choicePresets[newPresetId] = {
                                name: preset.name,
                                position: preset.position ?? 4,
                                role: preset.role ?? 0,
                                depth: preset.depth ?? 1,
                                order: preset.order ?? 250,
                                instruction: preset.instruction || ''
                            };
                            importedCount++;
                        }
                        
                        await SettingsStorage.save(settings);
                        
                        // 패널 새로고침
                        // createStatusBarChoicePanel - 전역 스코프에서 사용
                        const newPanelHtml = await createStatusBarChoicePanel();
                        const modalContent = container.querySelector('.modal-content');
                        if (modalContent) {
                            modalContent.innerHTML = newPanelHtml;
                            await this.setupStatusBarChoicePanelEvents(container);
                            const closeBtn = container.querySelector('.close-panel-btn');
                            if (closeBtn) {
                                closeBtn.addEventListener('click', () => this.closePanelModal());
                            }
                        }
                        
                        showToast(`프리셋 불러오기 성공! 파일: ${file.name}, 불러온 프리셋: ${importedCount}개`, 'success');
                    } catch (error) {
                        // 오류 코드 토스트 알림 표시
                        if (typeof showErrorCodeToast === 'function') {
                            showErrorCodeToast('ERR_PANEL_7010', '상태창/선택지 패널 프리셋 불러오기 오류', error);
                        } else if (typeof showToast === 'function') {
                            showToast(`프리셋 불러오기 실패: ${error.message}`, 'error');
                        }
                    }
                    
                    e.target.value = '';
                });
            }
            
            importBtn.addEventListener('click', () => {
                fileInput.click();
            });
        }
    }
}

