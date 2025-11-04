/**
 * 메뉴 관리 모듈
 * 사이드 메뉴 열기/닫기, 메뉴 항목 클릭 처리
 */

class MenuManager {
    constructor(elements) {
        this.elements = elements;
        this.setupEventListeners();
    }

    /**
     * 이벤트 리스너 설정
     */
    setupEventListeners() {
        // 메뉴 토글 버튼
        this.elements.menuBtn.addEventListener('click', () => {
            this.toggleSideMenu();
        });

        this.elements.closeMenuBtn.addEventListener('click', () => {
            this.toggleSideMenu();
        });

        // 메뉴 아이템 클릭 (동적으로 업데이트되는 메뉴도 처리하기 위해 이벤트 위임 사용)
        this.elements.sideMenu.addEventListener('click', (e) => {
            const menuItem = e.target.closest('.menu-item');
            if (!menuItem) return;

            // 메뉴 그룹 클릭 처리 (서브 메뉴 토글)
            const menuGroup = menuItem.dataset.menuGroup;
            if (menuGroup) {
                this.toggleSubmenu(menuGroup);
                e.stopPropagation();
                return;
            }

            // 일반 메뉴 아이템 클릭 처리
            const menu = menuItem.dataset.panel;
            if (menu) {
                this.handleMenuClick(menu);
            }
        });

        // 초기 이벤트 리스너 제거 (위의 이벤트 위임으로 대체)
        // document.querySelectorAll('.menu-item').forEach(item => {
        //     item.addEventListener('click', (e) => {
        //         const menu = e.currentTarget.dataset.panel;
        //         if (menu) {
        //             this.handleMenuClick(menu);
        //         }
        //     });
        // });
    }

    /**
     * 사이드 메뉴 토글
     */
    toggleSideMenu() {
        const isHidden = this.elements.sideMenu.classList.contains('hidden');
        if (isHidden) {
            this.openSideMenu();
        } else {
            this.closeSideMenu();
        }
    }

    /**
     * 사이드 메뉴 열기
     */
    openSideMenu() {
        // 이미 열리는 중이거나 열려있으면 무시
        if (!this.elements.sideMenu.classList.contains('hidden')) {
            return;
        }
        
        // closing 클래스 제거
        this.elements.sideMenu.classList.remove('closing');
        this.elements.overlay.classList.remove('closing', 'hidden');
        // 포인터 이벤트 복원
        this.elements.sideMenu.style.pointerEvents = '';
        this.elements.overlay.style.pointerEvents = '';
        
        // hidden 클래스 제거 - display: none이 아니므로 visibility만 변경
        // 브라우저가 리플로우하도록 한 프레임 대기 후 hidden 제거
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                this.elements.sideMenu.classList.remove('hidden');
            });
        });
    }

    /**
     * 사이드 메뉴 닫기
     */
    closeSideMenu() {
        // 이미 닫히는 중이면 무시
        if (this.elements.sideMenu.classList.contains('closing')) {
            return;
        }
        
        // 다른 모달/패널이 열리는 중인지 확인 (열려있으면 오버레이는 유지해야 함)
        const panelContainer = document.getElementById('panel-modal-container');
        const settingsModal = document.getElementById('settings-modal');
        const settingsModalOpen = settingsModal && !settingsModal.classList.contains('hidden');
        const isModalOpening = panelContainer || settingsModalOpen;
        
        // inline style 제거하여 CSS transition 작동하도록
        this.elements.sideMenu.style.transform = '';
        
        // 닫기 애니메이션 시작
        this.elements.sideMenu.classList.add('closing');
        
        // 다른 모달이 열려있지 않으면 오버레이도 닫기
        if (!isModalOpening) {
            this.elements.overlay.classList.add('closing');
        } else {
            // 다른 모달이 열려있으면 오버레이의 closing 클래스 제거 (오버레이는 유지)
            this.elements.overlay.classList.remove('closing');
        }
        
        // 즉시 클릭 방지 (애니메이션 중에도)
        this.elements.sideMenu.style.pointerEvents = 'none';
        
        // 애니메이션 완료 후 실제로 숨김
        const handleTransitionEnd = (e) => {
            // transform transition만 처리 (다른 transition 무시)
            if (e.propertyName !== 'transform') {
                return;
            }
            
            this.elements.sideMenu.removeEventListener('transitionend', handleTransitionEnd);
            this.elements.sideMenu.classList.remove('closing');
            this.elements.sideMenu.style.transform = ''; // inline style 제거
            this.elements.sideMenu.style.pointerEvents = ''; // 리셋
            this.elements.sideMenu.classList.add('hidden');
            
            // 다시 한 번 확인 (애니메이션 중에 모달이 열렸을 수 있음)
            const panelContainerAfter = document.getElementById('panel-modal-container');
            const settingsModalAfter = document.getElementById('settings-modal');
            const settingsModalOpenAfter = settingsModalAfter && !settingsModalAfter.classList.contains('hidden');
            const isModalOpeningAfter = panelContainerAfter || settingsModalOpenAfter;
            
            // 다른 모달/패널이 없으면 오버레이도 숨김
            if (!isModalOpeningAfter) {
                const handleOverlayEnd = () => {
                    this.elements.overlay.removeEventListener('animationend', handleOverlayEnd);
                    this.elements.overlay.classList.remove('closing');
                    this.elements.overlay.classList.add('hidden');
                    // 확실히 포인터 이벤트 차단
                    this.elements.overlay.style.pointerEvents = 'none';
                };
                this.elements.overlay.addEventListener('animationend', handleOverlayEnd);
            } else {
                // 다른 모달이 열려있으면 오버레이의 closing 클래스만 제거 (오버레이는 유지)
                this.elements.overlay.classList.remove('closing');
            }
        };
        
        this.elements.sideMenu.addEventListener('transitionend', handleTransitionEnd);
    }

    /**
     * 메뉴 항목 클릭 처리
     * @param {string} menu - 메뉴 타입
     */
    handleMenuClick(menu) {
        // 외부에서 설정된 콜백 함수 호출 (모달/패널이 열리기 전에)
        if (this.onMenuClick) {
            this.onMenuClick(menu);
        }
        
        // 메뉴 닫기 (모달/패널이 열렸는지 확인하고 오버레이 관리)
        // 약간의 지연을 두어 모달/패널이 먼저 열리도록 함
        setTimeout(() => {
            this.closeSideMenu();
        }, 10);
    }

    /**
     * 서브 메뉴 토글
     * @param {string} groupId - 메뉴 그룹 ID
     */
    toggleSubmenu(groupId) {
        const submenu = this.elements.sideMenu.querySelector(`[data-submenu="${groupId}"]`);
        const groupBtn = this.elements.sideMenu.querySelector(`[data-menu-group="${groupId}"]`);
        
        if (!submenu || !groupBtn) return;

        const isOpen = submenu.style.display !== 'none';
        
        // 모든 서브 메뉴 닫기
        this.elements.sideMenu.querySelectorAll('.menu-submenu').forEach(menu => {
            menu.style.display = 'none';
        });
        
        // 모든 그룹 버튼 화살표 리셋
        this.elements.sideMenu.querySelectorAll('.menu-group .menu-arrow').forEach(arrow => {
            arrow.textContent = '▶';
        });

        // 현재 서브 메뉴 토글
        if (isOpen) {
            submenu.style.display = 'none';
            const arrow = groupBtn.querySelector('.menu-arrow');
            if (arrow) arrow.textContent = '▶';
        } else {
            submenu.style.display = 'block';
            const arrow = groupBtn.querySelector('.menu-arrow');
            if (arrow) arrow.textContent = '▼';
        }
    }
}

