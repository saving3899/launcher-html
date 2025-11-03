/**
 * 매크로 치환 시스템
 * 실리태번의 substituteParams와 evaluateMacros 함수를 따름
 */

/**
 * 정규식 이스케이프 유틸리티
 * @param {string} str - 이스케이프할 문자열
 * @returns {string}
 */
function escapeRegex(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * UUID v4 생성
 * @returns {string}
 */
function uuidv4() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

/**
 * 매크로 값을 정리 (sanitize)
 * @param {any} value - 정리할 값
 * @returns {string}
 */
function sanitizeMacroValue(value) {
    if (value === null || value === undefined) {
        return '';
    }
    
    if (typeof value === 'string') {
        return value;
    }
    
    return String(value);
}

/**
 * 매크로 평가 함수
 * 실리태번의 evaluateMacros 함수와 동일
 * @param {string} content - 치환할 내용
 * @param {Object} env - 환경 변수 객체 (매크로 이름 -> 값)
 * @param {Function} [postProcessFn] - 후처리 함수
 * @returns {string}
 */
function evaluateMacros(content, env = {}, postProcessFn = (x) => x) {
    if (!content) {
        return '';
    }

    postProcessFn = typeof postProcessFn === 'function' ? postProcessFn : (x => x);
    const rawContent = content;

    /**
     * Pre-env 매크로 (환경 변수 이전에 실행)
     * @type {Array<{regex: RegExp, replace: Function}>}
     */
    const preEnvMacros = [
        // 레거시 비-컬리 매크로
        { 
            regex: /<USER>/gi, 
            replace: () => {
                const value = typeof env.user === 'function' ? env.user() : env.user;
                return sanitizeMacroValue(value);
            }
        },
        { 
            regex: /<BOT>/gi, 
            replace: () => {
                const value = typeof env.char === 'function' ? env.char() : env.char;
                return sanitizeMacroValue(value);
            }
        },
        { 
            regex: /<CHAR>/gi, 
            replace: () => {
                const value = typeof env.char === 'function' ? env.char() : env.char;
                return sanitizeMacroValue(value);
            }
        },
        { 
            regex: /<CHARIFNOTGROUP>/gi, 
            replace: () => {
                const value = typeof env.charIfNotGroup === 'function' ? env.charIfNotGroup() : env.charIfNotGroup;
                return sanitizeMacroValue(value);
            }
        },
        { 
            regex: /<GROUP>/gi, 
            replace: () => {
                const value = typeof env.group === 'function' ? env.group() : env.group;
                return sanitizeMacroValue(value);
            }
        },
        // 특수 매크로
        { regex: /{{newline}}/gi, replace: () => '\n' },
        { regex: /(?:\r?\n)*{{trim}}(?:\r?\n)*/gi, replace: () => '' },
        { regex: /{{noop}}/gi, replace: () => '' },
    ];

    /**
     * Post-env 매크로 (환경 변수 이후에 실행)
     * @type {Array<{regex: RegExp, replace: Function}>}
     */
    const postEnvMacros = [
        // 추가 특수 매크로는 나중에 구현
    ];

    const nonce = uuidv4();
    const envMacros = [];

    // 환경 변수 매크로 생성
    for (const varName in env) {
        if (!Object.hasOwn(env, varName)) continue;

        const envRegex = new RegExp(`{{${escapeRegex(varName)}}}`, 'gi');
        const envReplace = () => {
            const param = env[varName];
            const value = typeof param === 'function' ? param(nonce) : param;
            return sanitizeMacroValue(value);
        };

        envMacros.push({ regex: envRegex, replace: envReplace });
    }

    // 모든 매크로 합치기 (pre-env -> env -> post-env 순서)
    const macros = [...preEnvMacros, ...envMacros, ...postEnvMacros];

    // 매크로 치환 실행
    for (const macro of macros) {
        // 내용이 비어있으면 중단
        if (!content) {
            break;
        }

        // 중괄호가 없으면 건너뛰기 (성능 최적화)
        if (!macro.regex.source.startsWith('<') && !content.includes('{{')) {
            break;
        }

        try {
            content = content.replace(macro.regex, (...args) => {
                const replaced = macro.replace(...args);
                return postProcessFn(replaced);
            });
        } catch (e) {
            // 경고 코드 토스트 알림 표시
            if (typeof showErrorCodeToast === 'function') {
                showErrorCodeToast('WARN_CHAT_20030', `매크로 치환 실패: ${macro.regex}`, e);
            }
        }
    }

    return content;
}

/**
 * 매개변수 치환 함수
 * 실리태번의 substituteParams 함수와 동일
 * @param {string} content - 치환할 내용
 * @param {string} [_name1] - 사용자 이름 (기본값: 전역 name1)
 * @param {string} [_name2] - 캐릭터 이름 (기본값: 전역 name2)
 * @param {string} [_original] - 원본 메시지 ({{original}}용)
 * @param {string} [_group] - 그룹 멤버 목록
 * @param {boolean} [_replaceCharacterCard=true] - 캐릭터 카드 매크로 치환 여부
 * @param {Object} [additionalMacro={}] - 추가 매크로 객체
 * @param {Function} [postProcessFn] - 후처리 함수
 * @returns {string}
 */
function substituteParams(
    content,
    _name1 = '',
    _name2 = '',
    _original = '',
    _group = '',
    _replaceCharacterCard = true,
    additionalMacro = {},
    postProcessFn = (x) => x
) {
    if (!content) {
        return '';
    }

    const environment = {};

    // original 처리 (한 번만 치환)
    if (typeof _original === 'string' && _original) {
        let originalSubstituted = false;
        environment.original = () => {
            if (originalSubstituted) {
                return '';
            }
            originalSubstituted = true;
            return _original;
        };
    }

    // 기본 매크로 설정
    environment.user = _name1 || '';
    environment.char = _name2 || '';

    // charIfNotGroup: 그룹이 아니면 캐릭터 이름, 그룹이면 그룹 목록
    if (_group && typeof _group === 'string' && _group.trim()) {
        environment.charIfNotGroup = _group;
        environment.group = _group;
    } else {
        environment.charIfNotGroup = _name2 || '';
        environment.group = '';
    }

    // 시간 관련 매크로
    const now = new Date();
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    environment.time = `${hours}:${minutes}`;
    
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    environment.date = `${year}-${month}-${day}`;
    
    const weekdays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    environment.weekday = weekdays[now.getDay()];

    // 추가 매크로 병합
    Object.assign(environment, additionalMacro);

    // evaluateMacros 호출
    return evaluateMacros(content, environment, postProcessFn);
}

/**
 * 확장 매개변수 치환 함수
 * 실리태번의 substituteParamsExtended 함수와 동일
 * @param {string} content - 치환할 내용
 * @param {Object} [additionalMacro={}] - 추가 매크로 객체
 * @param {Function} [postProcessFn] - 후처리 함수
 * @returns {string}
 */
function substituteParamsExtended(content, additionalMacro = {}, postProcessFn = (x) => x) {
    return substituteParams(content, '', '', '', '', true, additionalMacro, postProcessFn);
}

