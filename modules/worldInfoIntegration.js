/**
 * 월드인포 통합 함수
 * 실리태번의 world-info.js getWorldInfoPrompt 함수와 호환
 * 
 * 현재는 기본 구조만 구현. 실제 월드인포 스캔 로직은 나중에 통합 예정.
 */

/**
 * 월드인포 프롬프트 가져오기
 * 실리태번의 getWorldInfoPrompt 함수와 동일한 시그니처
 * 
 * @param {Array} chat - 채팅 메시지 배열 (역순)
 * @param {number} maxContext - 최대 컨텍스트 크기
 * @param {boolean} isDryRun - 드라이런 여부
 * @param {Object} globalScanData - 전역 스캔 데이터
 * @returns {Promise<Object>} 월드인포 결과 객체
 */
async function getWorldInfoPrompt(chat, maxContext, isDryRun, globalScanData = {}) {
    // TODO: 실제 월드인포 스캔 로직 구현 필요
    // 현재는 빈 문자열 반환 (월드인포 시스템이 완전히 구현되면 통합)
    
    // 기본값 반환 (실리태번 구조와 동일)
    return {
        worldInfoString: '',
        worldInfoBefore: '',
        worldInfoAfter: '',
        worldInfoExamples: [],
        worldInfoDepth: [],
        anBefore: [],
        anAfter: [],
        outletEntries: {},
    };
}

/**
 * 월드인포 설정 가져오기
 * 실리태번의 setWorldInfoSettings와 호환
 * 
 * @returns {Object} 월드인포 설정 객체
 */
function getWorldInfoSettings() {
    // TODO: 실제 월드인포 설정 로드
    return {
        world_info_depth: 4,
        world_info_min_activations: 1,
        world_info_min_activations_depth_max: 999,
        world_info_budget: 25,
        world_info_include_names: true,
        world_info_recursive: false,
        world_info_overflow_alert: true,
        world_info_case_sensitive: false,
        world_info_match_whole_words: false,
        world_info_character_strategy: 0,
        world_info_budget_cap: 0,
        world_info_max_recursion_steps: 5,
        world_info_use_group_scoring: false,
    };
}

/**
 * 월드인포 설정 적용
 * 실리태번의 setWorldInfoSettings와 호환
 * 
 * @param {Object} settings - 설정 객체
 * @param {Object} data - 추가 데이터
 */
function setWorldInfoSettings(settings, data = {}) {
    // TODO: 실제 월드인포 설정 저장
}

