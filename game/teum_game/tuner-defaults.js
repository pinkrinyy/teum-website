/* 틈새살이 좌표 기본값 - 게임(gpt-kitchen-game.js)과 좌표 수정 도구(좌표수정도구.html)가 같이 읽는다.
   실제 좌표는 tuner-state.js(좌표 수정 도구로 만든 파일)가 이 값 위에 덮어쓴다. 좌표 기준: 배경 그림 2046x1686의 % */
(function(){
  var DEFAULTS = {
    table:      { top:47.1, left:31.3, width:55 },  // 크롭된 테이블 이미지를 배경에 맞춰 맞춘 초기값(추정치)
    fridgeEmpty:{ top:28.7, left:5,     width:27.5 },  // 냉장고 위치·크기 - object/fridge/ 그림 전부(닫힘·열림·가득)가 같은 캔버스라 하나로 쓴다
    sortY:      64,                                    // 테이블 Y-sort 기준선 (kitchenScene 세로 %, 세로는 배경 교체 영향 없음)
    kitchenFridgeIcon: { top:22,   left:16.59,  size:100 },    // 냉장고 상단 알림 아이콘 (size: 배율 %, 100=원본)
    fridgePoint:{ top:70,   left:17.83 },              // 냉장고 앞 인터랙션(도착) 지점
    playerStart:{ top:94,   left:49.95 },              // 테이블 앞 시작 위치
    // 가구 "바닥 접지면" 충돌 다각형(Polygon Footprint). 화면 기준 직사각형이 아니라
    // 아이소메트릭 각도에 맞춘 다각형으로, 가구 윗부분은 충돌하지 않고 바닥에 닿은
    // 면적만 캐릭터(발끝 중심점)를 막는다. 아래 좌표는 대략적인 시작값이며,
    // 🧩 충돌 다각형 편집기(~ 키 또는 화면 버튼)로 화면을 보면서 직접 정밀하게 다시
    // 찍어서 저장하는 것을 권장한다.
    colliders: {
      fridge:  { label:'냉장고 바닥',       points:[ {x:12.88,y:55.0}, {x:25.24,y:59.0}, {x:12.88,y:63.0}, {x:0.53,y:59.0} ] },
      table:   { label:'식탁 바닥',         points:[ {x:45.01,y:57.0}, {x:68.48,y:73.0}, {x:45.01,y:89.0}, {x:21.53,y:73.0} ] },
      counter: { label:'싱크대/조리대 바닥', points:[ {x:11.65,y:40.0}, {x:59.84,y:36.0}, {x:72.19,y:44.0}, {x:72.19,y:60.0}, {x:57.36,y:69.0}, {x:25.24,y:60.0} ] },
      shelf:   { label:'선반/화분 바닥',     points:[ {x:72.19,y:62.0}, {x:100.0,y:68.0}, {x:100.0,y:85.0}, {x:87.02,y:81.0}, {x:72.19,y:73.0} ] }
    }
  };

  // 두 번째 미션(다용도실) 전용 오브젝트/충돌 기본값. 부엌(DEFAULTS)과 완전히 분리된
  // 별도의 좌표계(금전형 방 배경 kitchen_bg22.png 기준 %)를 쓴다.
  // v6 -> v7: 다용도실 배경을 다시 object-fit 없이(가로로 늘어나는 걸 허용하고 세로는
  // 절대 안 잘리게) 꽉 채우는 방식으로 되돌리면서, % 좌표 기준도 "원본 이미지 기준 %"로 복귀.
  var UTILITY_DEFAULTS = {
    laundry: { top:47, left:62, width:16 }, // 빨래더미(laundry_not) 위치·크기 - 🧺 튜너로 조절. 완료 후 빈 바구니·개킨 빨래도 이 값을 따라감
    laundryIcon: { top:48.2, left:70.3, size:100 }, // 세탁물 상태이상 알림 아이콘 (빨래더미 위) (size: 배율 %, 100=원본) - ❗ 튜너로 조절
    laundryPoint: { top:71, left:76 }, // 세탁물 더미 앞 인터랙션(도착) 지점 - 빨래더미 오른쪽 앞 바닥 - 📍 튜너로 조절
    laundryBasket: { top:83, left:12, width:15 }, // 세탁 완료 후 나타나는 빨래 바구니 위치·크기 - 🧺✅ 튜너로 조절
    laundryClothes: { top:52, left:56, width:14 }, // 세탁 완료 후 바구니 옆에 튀어나오는 개킨 빨래(laundry.png) 위치·크기 - 👕 튜너로 조절
    // 한방판: 금전형 방 = 부엌 그림(kitchen_bg22.png, room-images.js) - 냉장고는 원래 부엌 자리, 빨래 더미는 오븐 옆 바닥
    fridge: { top:26.7, left:5, width:28.9 },       // 냉장고 위치·크기 (object/fridge/ 그림 전부 같은 캔버스)
    fridgeIcon: { top:31.6, left:15.1, size:100 },  // 냉장고 핀
    fridgePoint: { top:81, left:29 },               // 냉장고 열 때 서는 자리 (냉장고 오른쪽 아래)
    colliders: {} // 세탁기·선반 바닥은 부엌 그림엔 없음. 조리대는 걸을 수 있는 영역에서 이미 빠져 있고, 냉장고·빨래는 그림 모양이 막는다
  };
  // DEFAULTS 안에도 그대로 얹어둬서, 저장된 값이 아예 없거나 손상됐을 때(JSON.parse(JSON.stringify(DEFAULTS))
  // 로 초기 상태를 만드는 경로들)도 utility 항목이 함께 채워지게 한다.
  DEFAULTS.utility = UTILITY_DEFAULTS;

  // 서은민(A) 메이트 전용 부엌 오브젝트/충돌 기본값. 강은지(S)의 부엌(DEFAULTS)과는
  // 완전히 분리된 별도의 좌표계(dirty/clean_kichen_bg.png 기준 %, 두 이미지 모두 강은지
  // 부엌과 같은 2046x1686 캔버스라 SCENE_W/H는 그대로 재사용한다)를 쓴다.
  var EUNMIN_KITCHEN_DEFAULTS = {
    diningTable: { top:58, left:36, width:32 }, // 밥먹는 식탁 데코레이션(부엌 중앙) - 🍚 튜너로 조절
    dishWash: { top:29.8, left:32.7, width:19.4 }, // 싱크대 설거지 더미(dish wash.png) - 🍽 튜너로 조절. 배경 2046x1686의 (670,502) 원본 크기 (좌표수정도구와 같은 값)
    trash: { top:43.2, left:77.4, width:18 }, // 쓰레기통 위 쓰레기(trash.png) - 🗑 튜너로 조절. 배경의 (1583,728) 원본 크기
    livingroomPoint: { top:80, left:85 }, // 거실로 이동 시 캐릭터가 걸어가는 도착 지점(부엌 쪽 좌표) - 📍 튜너로 조절
    sinkIcon: { top:28, left:40, size:100 }, // 싱크대 상태이상 알림 아이콘 (size: 배율 %, 100=원본) - ❗ 튜너로 조절
    sinkPoint: { top:70, left:45 }, // 싱크대 앞 인터랙션(도착) 지점 - 📍 튜너로 조절
    binsIcon: { top:55, left:83, size:100 }, // 쓰레기통 상태이상 알림 아이콘 - ❗ 튜너로 조절
    binsPoint: { top:78, left:80 }, // 쓰레기통 앞 인터랙션(도착) 지점 - 📍 튜너로 조절
    bubbleIcon: { top:25, left:65, size:90 }, // 말풍선 상태 버튼(미션과 무관, 상시 노출) - 💬 튜너로 조절
    // 한방판: 규칙형 생활비 정산도 부엌에서 - 고지서는 식탁 위
    notice: { top:57, left:49, width:8.9 },          // 생활비 고지서 그림(Payment notice.png) 위치·크기
    paperIcon: { top:56.8, left:53.5, size:194 },    // 고지서 핀
    paperPoint: { top:82, left:64 },                 // 고지서 볼 때 서는 자리
    colliders: {
      sink: { label:'싱크대 바닥', points:[ {x:11.65,y:40.0}, {x:59.84,y:36.0}, {x:72.19,y:44.0}, {x:72.19,y:60.0}, {x:57.36,y:69.0}, {x:25.24,y:60.0} ] },
      bins: { label:'쓰레기통 바닥', points:[ {x:72.19,y:62.0}, {x:100.0,y:68.0}, {x:100.0,y:85.0}, {x:87.02,y:81.0}, {x:72.19,y:73.0} ] },
      // 식탁(diningTable) 데코레이션 대략적인 위치(top:58,left:36,width:32) 근처의 임시
      // 육각형 - 🧩 충돌 다각형 편집기에서 직접 정밀하게 다시 찍어서 조정하면 된다.
      table: { label:'식탁 바닥', points:[ {x:33.0,y:62.0}, {x:57.0,y:58.0}, {x:66.0,y:66.0}, {x:60.0,y:78.0}, {x:36.0,y:80.0}, {x:27.0,y:70.0} ] },
      // 이동 가능 영역(바닥) - 다른 충돌 다각형과 반대로, 이 다각형 "밖"이 막힌다.
      // 관람객/메이트가 벽이나 방 바깥으로 걸어 나가지 않게 한다. 🧩 편집기에서 다시 찍을 수 있다.
      floor: { label:'이동 가능 영역', points:[ {x:25.0,y:64.0}, {x:53.0,y:50.0}, {x:76.0,y:62.0}, {x:99.0,y:73.0}, {x:50.0,y:100.0}, {x:1.0,y:70.0}, {x:24.0,y:68.0} ] }
    }
  };
  DEFAULTS.eunminKitchen = EUNMIN_KITCHEN_DEFAULTS;

  // 서은민(A) 메이트 미션2(틈새살림 정산) 전용 거실 충돌 기본값. 거실 배경(living_room.png)도
  // 2046x1686 캔버스라 부엌과 같은 좌표계를 그대로 쓴다.
  var LIVINGROOM_DEFAULTS = {
    paperIcon: { top:50, left:50, size:100 }, // 거실 식탁 위 정산 종이 상태이상 알림 아이콘 - ❗ 튜너로 조절
    paperPoint: { top:74, left:50 }, // 종이(식탁) 앞 인터랙션(도착) 지점 - 📍 튜너로 조절
    colliders: {
      sofa:        { label:'소파 바닥',   points:[ {x:5.0,y:55.0}, {x:32.0,y:48.0}, {x:38.0,y:62.0}, {x:10.0,y:70.0} ] },
      livingTable: { label:'테이블 바닥', points:[ {x:38.0,y:58.0}, {x:62.0,y:55.0}, {x:66.0,y:68.0}, {x:42.0,y:72.0} ] },
      bookshelf:   { label:'책장 바닥',   points:[ {x:78.0,y:55.0}, {x:97.0,y:52.0}, {x:99.0,y:64.0}, {x:80.0,y:67.0} ] },
      // 이동 가능 영역(바닥) - 이 다각형 "밖"이 막힌다(오른쪽 문 앞 매트까지 포함).
      floor:       { label:'이동 가능 영역', points:[ {x:49.0,y:37.0}, {x:96.0,y:65.0}, {x:99.0,y:67.0}, {x:50.0,y:100.0}, {x:1.0,y:61.0} ] }
    }
  };
  DEFAULTS.livingroom = LIVINGROOM_DEFAULTS;
  window.TEUM_TUNER_DEFAULTS = DEFAULTS;

  /* 좌표 만들기 (게임·좌표 수정 도구 공용): 이 기본값 위에 tuner-state.js 값을 통째로 깊게 덮는다.
     충돌 다각형은 점이 3개 미만이거나 깨진 값이면 기본값으로. 새 항목은 위 기본값에만 추가하면 된다 */
  function mergeColliders(defaults, parsed){
    var result = {};
    Object.keys(defaults).forEach(function(key){
      var def = defaults[key];
      var p = parsed && parsed[key];
      if(p && Array.isArray(p.points) && p.points.length >= 3){
        result[key] = {
          label: (typeof p.label === 'string' && p.label) ? p.label : def.label,
          points: p.points.map(function(pt){ return { x:Number(pt.x) || 0, y:Number(pt.y) || 0 }; })
        };
      } else {
        result[key] = { label: def.label, points: def.points.map(function(pt){ return { x:pt.x, y:pt.y }; }) };
      }
    });
    if(parsed){
      Object.keys(parsed).forEach(function(key){
        if(result[key]) return;
        var p = parsed[key];
        if(p && Array.isArray(p.points) && p.points.length >= 3){
          result[key] = {
            label: (typeof p.label === 'string' && p.label) ? p.label : key,
            points: p.points.map(function(pt){ return { x:Number(pt.x) || 0, y:Number(pt.y) || 0 }; })
          };
        }
      });
    }
    return result;
  }

  function cloneJSON(v){ return JSON.parse(JSON.stringify(v)); }
  function deepMergeState(base, over){
    if(over === undefined || over === null) return base === undefined ? undefined : cloneJSON(base);
    if(Array.isArray(over)) return cloneJSON(over);
    if(typeof base === 'number') return (typeof over === 'number' && isFinite(over)) ? over : base; // 숫자 칸에 깨진 값이 오면 무시
    if(typeof over !== 'object') return over;
    if(!base || typeof base !== 'object' || Array.isArray(base)) return cloneJSON(over);
    var out = {};
    Object.keys(base).forEach(function(k){ out[k] = deepMergeState(base[k], over[k]); });
    Object.keys(over).forEach(function(k){ if(!(k in out)) out[k] = cloneJSON(over[k]); });
    return out;
  }
  function buildState(file){
    var merged = cloneJSON(DEFAULTS);
    if(file && typeof file === 'object') merged = deepMergeState(merged, file);
    // 충돌 다각형은 점이 3개 미만이거나 깨진 값이면 기본값으로(코드에 없는 새 다각형도 그대로 보존)
    merged.colliders = mergeColliders(DEFAULTS.colliders, merged.colliders);
    merged.utility.colliders = mergeColliders(UTILITY_DEFAULTS.colliders, merged.utility.colliders);
    merged.eunminKitchen.colliders = mergeColliders(EUNMIN_KITCHEN_DEFAULTS.colliders, merged.eunminKitchen.colliders);
    merged.livingroom.colliders = mergeColliders(LIVINGROOM_DEFAULTS.colliders, merged.livingroom.colliders);
    // 예전 옷더미(clothes.png) 기본값(73/9/21)이 저장돼 있으면 새 그림 기본값으로 (바구니 위에 겹쳐 보이지 않게)
    var c = merged.utility.laundryClothes;
    if(c && c.top === 73 && c.left === 9 && c.width === 21) merged.utility.laundryClothes = cloneJSON(UTILITY_DEFAULTS.laundryClothes);
    // 세탁물 핀 예전 위치(바닥 72/26)가 저장돼 있으면 좌표수정도구에서 정한 빨래더미 위 위치로
    var li = merged.utility.laundryIcon;
    if(li && li.top === 72 && li.left === 26) merged.utility.laundryIcon = cloneJSON(UTILITY_DEFAULTS.laundryIcon);
    // 식탁 예전 위치(44.7/24.5/55.4)가 저장돼 있으면 좌표수정도구 위치로 - 식탁 바닥 충돌 다각형도 같이 옮긴다
    var t = merged.table;
    if(t && t.top === 44.7 && t.left === 24.5 && t.width === 55.4){
      var nt = DEFAULTS.table, k = nt.width / t.width, tc = merged.colliders.table;
      if(tc && tc.points) tc.points.forEach(function(p){
        p.x = Math.round((nt.left + (p.x - t.left) * k) * 10) / 10;
        p.y = Math.round((nt.top + (p.y - t.top) * k) * 10) / 10;
      });
      merged.table = cloneJSON(nt);
    }
    return merged;
  }

  window.TEUM_buildTunerState = buildState;
})();
