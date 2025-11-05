/**
 * 유틸리티 함수들
 */

/**
 * humanizedDateTime 함수
 * 실리태번의 RossAscends-mods.js humanizedDateTime 함수와 동일
 * @returns {string} YYYY-MM-DD@HHhMMmSSs 형식의 날짜 문자열
 * @example "2024-01-15@14h30m45s"
 */
function humanizedDateTime() {
    const now = new Date(Date.now());
    const dt = {
        year: now.getFullYear(),
        month: now.getMonth() + 1,
        day: now.getDate(),
        hour: now.getHours(),
        minute: now.getMinutes(),
        second: now.getSeconds(),
    };
    
    for (const key in dt) {
        dt[key] = dt[key].toString().padStart(2, '0');
    }
    
    return `${dt.year}-${dt.month}-${dt.day}@${dt.hour}h${dt.minute}m${dt.second}s`;
}

/**
 * HTML 이스케이프
 * @param {string} text - 이스케이프할 텍스트
 * @returns {string} 이스케이프된 텍스트
 */
function escapeHtml(text) {
    if (typeof text !== 'string') {
        return '';
    }
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

/**
 * getMessageTimeStamp 함수 (실리태번의 RossAscends-mods.js와 동일)
 * 타임스탬프를 "October 27, 2025 8:04pm" 형식으로 변환
 * @param {number} [timestamp] - 타임스탬프 (밀리초), 없으면 현재 시간
 * @returns {string} "October 27, 2025 8:04pm" 형식의 날짜 문자열
 */
function getMessageTimeStamp(timestamp = Date.now()) {
    const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    const d = new Date(timestamp);
    const month = months[d.getMonth()];
    const day = d.getDate();
    const year = d.getFullYear();
    let hours = d.getHours();
    const minutes = ('0' + d.getMinutes()).slice(-2);
    let meridiem = 'am';
    if (hours >= 12) {
        meridiem = 'pm';
        hours -= 12;
    }
    if (hours === 0) {
        hours = 12;
    }
    const formattedDate = month + ' ' + day + ', ' + year + ' ' + hours + ':' + minutes + meridiem;
    return formattedDate;
}

/**
 * humanizedISO8601DateTime 함수 (실리태번의 util.js와 동일)
 * 타임스탬프를 "2025-10-27 @20h 04m 52s 123ms" 형식으로 변환
 * @param {number|Date} [date] - 타임스탬프 또는 Date 객체, 없으면 현재 시간
 * @returns {string} "2025-10-27 @20h 04m 52s 123ms" 형식의 날짜 문자열
 */
function humanizedISO8601DateTime(date = Date.now()) {
    const baseDate = typeof date === 'number' ? new Date(date) : date instanceof Date ? date : new Date();
    const humanYear = baseDate.getFullYear();
    const humanMonth = (baseDate.getMonth() + 1);
    const humanDate = baseDate.getDate();
    const humanHour = (baseDate.getHours() < 10 ? '0' : '') + baseDate.getHours();
    const humanMinute = (baseDate.getMinutes() < 10 ? '0' : '') + baseDate.getMinutes();
    const humanSecond = (baseDate.getSeconds() < 10 ? '0' : '') + baseDate.getSeconds();
    const humanMillisecond = (baseDate.getMilliseconds() < 10 ? '0' : '') + baseDate.getMilliseconds();
    const HumanizedDateTime = (humanYear + '-' + humanMonth + '-' + humanDate + ' @' + humanHour + 'h ' + humanMinute + 'm ' + humanSecond + 's ' + humanMillisecond + 'ms');
    return HumanizedDateTime;
}

/**
 * 대기 중인 효과음 재생 (탭 포커스 시 호출)
 */
let pendingSoundUrl = null;

/**
 * 백그라운드 탭에서도 작동하는 DOM 업데이트 대기 함수
 * 백그라운드 탭에서는 requestAnimationFrame이 throttling되므로 즉시 실행
 * 포커스된 탭에서는 requestAnimationFrame 사용
 * @returns {Promise<void>}
 */
function waitForDOMUpdate() {
    return new Promise((resolve) => {
        // 백그라운드 탭 확인
        try {
            const isHidden = document.hidden;
            const hasFocus = document.hasFocus();
            
            if (isHidden || !hasFocus) {
                // 백그라운드 탭에서는 즉시 실행 (requestAnimationFrame이 throttling됨)
                // DOM 업데이트는 동기적으로 즉시 반영되므로, 마이크로태스크 큐를 사용하여 즉시 실행
                // 여러 번 호출하여 완전히 실행되도록 보장
                Promise.resolve().then(() => {
                    Promise.resolve().then(resolve);
                });
            } else {
                // 포커스된 탭에서는 requestAnimationFrame 사용
                requestAnimationFrame(() => {
                    requestAnimationFrame(resolve);
                });
            }
        } catch (e) {
            // document.hasFocus가 지원되지 않거나 오류 발생 시 폴백
            // 백그라운드일 수 있으므로 Promise 사용
            Promise.resolve().then(() => {
                Promise.resolve().then(resolve);
            });
        }
    });
}

/**
 * 메시지 효과음 재생 (실리태번과 동일)
 * @returns {Promise<void>}
 */
async function playMessageSound() {
    // SettingsStorage, UserSoundStorage - 전역 스코프에서 사용
    
    const settings = await SettingsStorage.load();
    
    if (!settings.play_message_sound) {
        return;
    }
    
    // 브라우저 포커스 확인 (document.hasFocus는 대부분의 브라우저에서 지원)
    let browserHasFocus = true;
    try {
        browserHasFocus = document.hasFocus();
    } catch (e) {
        // document.hasFocus가 지원되지 않는 경우 기본값 사용
        browserHasFocus = true;
    }
    
    // 현재 선택된 효과음 ID 가져오기
    const currentSoundId = settings.current_sound_id || 'default';
    
    // 효과음 URL 가져오기
    let soundUrl = 'public/sounds/message.mp3'; // 기본 효과음
    
    if (currentSoundId.startsWith('sound_')) {
        // 기본 효과음 (sound_0, sound_1, ...)
        const soundIndex = parseInt(currentSoundId.replace('sound_', ''), 10);
        const defaultSoundFiles = [
            'message.mp3',
            'Blop.mp3',
            'Coin.mp3',
            'Correct.mp3',
            'Glow.mp3',
            'Pop.mp3',
            'Stapler.mp3',
            'Tiny Button.mp3'
        ].sort((a, b) => {
            if (a === 'message.mp3') return -1;
            if (b === 'message.mp3') return 1;
            return a.localeCompare(b);
        });
        
        if (soundIndex >= 0 && soundIndex < defaultSoundFiles.length) {
            soundUrl = `public/sounds/${defaultSoundFiles[soundIndex]}`;
        }
    } else if (currentSoundId !== 'default') {
        // 유저 업로드 효과음 로드
        const userSound = await UserSoundStorage.load(currentSoundId);
        if (userSound && userSound.url) {
            soundUrl = userSound.url;
        }
    }
    
    // play_sound_unfocused 설정 확인
    // false = 백그라운드에서도 재생 시도, true = 포커스된 탭에서만 재생
    // 백그라운드 탭이고 play_sound_unfocused가 true이면 재생하지 않고 대기
    if (!browserHasFocus && settings.play_sound_unfocused) {
        // 백그라운드 탭이고 play_sound_unfocused가 true이면 재생하지 않고 대기
        // 탭 포커스 시 재생하도록 pendingSoundUrl에 저장
        pendingSoundUrl = soundUrl;
        return;
    }
    
    // 오디오 엘리먼트 찾기 또는 생성
    let audioElement = document.getElementById('audio_message_sound');
    
    if (!audioElement) {
        // 오디오 엘리먼트가 없으면 생성
        audioElement = document.createElement('audio');
        audioElement.id = 'audio_message_sound';
        audioElement.hidden = true;
        document.body.appendChild(audioElement);
    }
    
    // iOS에서 간헐적 재생 실패 문제 해결: 오디오를 완전히 초기화
    audioElement.pause();
    audioElement.currentTime = 0;
    audioElement.volume = 0.8;
    
    // 효과음 URL 설정 (src가 변경되면 로드 필요)
    const isNewSource = audioElement.src !== soundUrl || !audioElement.src;
    if (isNewSource) {
        audioElement.src = soundUrl;
    }
    
    // 효과음 재생 시도
    try {
        // iOS에서 간헐적 재생 실패 문제 해결: 오디오 로드 완료 대기
        if (isNewSource || audioElement.readyState < 2) {
            // 새로운 소스이거나 아직 로드되지 않은 경우 로드 대기
            await new Promise((resolve, reject) => {
                const timeout = setTimeout(() => {
                    // 타임아웃 시에도 재생 시도 (네트워크 문제일 수 있음)
                    resolve();
                }, 2000); // 2초 타임아웃
                
                const onLoaded = () => {
                    clearTimeout(timeout);
                    audioElement.removeEventListener('error', onError);
                    resolve();
                };
                
                const onError = () => {
                    clearTimeout(timeout);
                    audioElement.removeEventListener('loadeddata', onLoaded);
                    resolve(); // 에러여도 재생 시도
                };
                
                if (audioElement.readyState >= 2) {
                    // 이미 로드된 경우
                    clearTimeout(timeout);
                    resolve();
                } else {
                    audioElement.addEventListener('loadeddata', onLoaded, { once: true });
                    audioElement.addEventListener('error', onError, { once: true });
                    // load() 호출로 명시적으로 로드 시작
                    audioElement.load();
                }
            });
        }
        
        // 재생 전에 다시 한 번 초기화 (iOS에서 안전하게)
        audioElement.pause();
        audioElement.currentTime = 0;
        
        await audioElement.play();
        // 재생 성공 시 대기 중인 효과음 제거
        pendingSoundUrl = null;
    } catch (error) {
        // 재생 실패 시 (탭이 포커스되지 않았거나 자동 재생이 차단된 경우)
        // play_sound_unfocused가 false이면 백그라운드에서도 재생 시도했지만 실패한 경우
        // 대기 중인 효과음으로 저장 (탭 포커스 시 재생)
        pendingSoundUrl = soundUrl;
        console.debug('[playMessageSound] 효과음 재생 실패 (탭 포커스 대기):', error);
    }
}

/**
 * 탭 포커스 시 대기 중인 효과음 재생
 */
async function playPendingSound() {
    if (pendingSoundUrl) {
        const audioElement = document.getElementById('audio_message_sound');
        if (audioElement) {
            try {
                // iOS에서 간헐적 재생 실패 문제 해결: 오디오를 완전히 초기화
                audioElement.pause();
                audioElement.currentTime = 0;
                audioElement.volume = 0.8;
                
                const isNewSource = audioElement.src !== pendingSoundUrl || !audioElement.src;
                if (isNewSource) {
                    audioElement.src = pendingSoundUrl;
                }
                
                // iOS에서 간헐적 재생 실패 문제 해결: 오디오 로드 완료 대기
                if (isNewSource || audioElement.readyState < 2) {
                    await new Promise((resolve) => {
                        const timeout = setTimeout(() => resolve(), 2000);
                        
                        const onLoaded = () => {
                            clearTimeout(timeout);
                            audioElement.removeEventListener('error', onError);
                            resolve();
                        };
                        
                        const onError = () => {
                            clearTimeout(timeout);
                            audioElement.removeEventListener('loadeddata', onLoaded);
                            resolve();
                        };
                        
                        if (audioElement.readyState >= 2) {
                            clearTimeout(timeout);
                            resolve();
                        } else {
                            audioElement.addEventListener('loadeddata', onLoaded, { once: true });
                            audioElement.addEventListener('error', onError, { once: true });
                            audioElement.load();
                        }
                    });
                }
                
                // 재생 전에 다시 한 번 초기화
                audioElement.pause();
                audioElement.currentTime = 0;
                
                await audioElement.play();
                pendingSoundUrl = null; // 재생 성공 시 대기 중인 효과음 제거
            } catch (error) {
                console.debug('[playPendingSound] 효과음 재생 실패:', error);
            }
        }
    }
}

// 탭 포커스 이벤트 리스너 등록 (한 번만)
if (typeof window !== 'undefined' && !window._messageSoundListenerAdded) {
    window.addEventListener('visibilitychange', () => {
        if (!document.hidden) {
            // 탭이 포커스되었을 때 대기 중인 효과음 재생
            playPendingSound();
        }
    });
    
    window.addEventListener('focus', () => {
        // 창 포커스 시에도 대기 중인 효과음 재생
        playPendingSound();
    });
    
    window._messageSoundListenerAdded = true;
}

