const clamp=(n,min,max)=>Math.max(min,Math.min(max,n));
const pointGap=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const blend=(a,b,amount)=>({x:a.x+(b.x-a.x)*amount,y:a.y+(b.y-a.y)*amount});

export function gestureTracker() {
  const pinchStates=new Map();
  let cursor=null;
  let cursorKey=null;
  let drag=null;
  let pair=null;
  let released=false;
  let blockSingle=false;

  function reset() {
    pinchStates.clear();
    cursor=cursorKey=drag=pair=null;
    released=blockSingle=false;
  }

  function update(hands,bounds,time,aspect=4/3) {
    const commands=[];
    if(!hands.length){
      if(drag||pair)commands.push({type:'cancel'});
      reset();
      return {cursor:null,pose:'waiting',commands};
    }

    const realGap=(a,b)=>Math.hypot((a.x-b.x)*aspect,a.y-b.y);
    const duplicateId=hands.length>1&&hands[0].id===hands[1].id;
    const tips=hands.slice(0,2).map(({id,points},i)=>{
      const key=!duplicateId&&id?id:String(i);
      const index=points[8],thumb=points[4];
      const size=Math.max(realGap(points[5],points[17]),.63*realGap(points[0],points[9]),.022);
      const ratio=realGap(index,thumb)/size;
      const pinch=ratio<(pinchStates.get(key)?.48:.31);
      pinchStates.set(key,pinch);
      const location=pinch?blend(index,thumb,.26):index;
      return {
        key,pinch,
        screen:{
          x:clamp(.5+(.5-location.x)*1.64,.008,.992)*bounds.width,
          y:clamp(.5+(location.y-.5)*1.57,.008,.992)*bounds.height,
        },
      };
    });
    const held=tips.filter(hand=>hand.pinch);
    if(!held.length){
      released=true;
      blockSingle=false;
    }
    const target=tips.find(hand=>hand.key===drag?.key)||held[0]||tips.find(hand=>hand.key===cursorKey)||tips[0];
    const prior=cursorKey===target.key?cursor:null;
    cursorKey=target.key;
    cursor=prior?blend(prior,target.screen,held.length?.34:.42):target.screen;

    if(held.length===2&&released){
      const center=blend(held[0].screen,held[1].screen,.5);
      const distance=pointGap(held[0].screen,held[1].screen);
      if(!pair){
        pair={center,distance};
        if(drag)commands.push({type:'cancel'});
        drag=null;
      }else{
        const nextCenter=blend(pair.center,center,.38);
        const nextDistance=pair.distance+(distance-pair.distance)*.39;
        const factor=nextDistance>32&&pair.distance>32?clamp(pair.distance/nextDistance,.86,1.16):1;
        if(Math.abs(factor-1)>.009||pointGap(nextCenter,pair.center)>2){
          commands.push({type:'zoom',factor,dx:nextCenter.x-pair.center.x,dy:nextCenter.y-pair.center.y});
        }
        pair={center:nextCenter,distance:nextDistance};
      }
      blockSingle=true;
      return {cursor:center,pose:'zoom',commands};
    }
    if(pair)pair=null;
    const hand=held[0];
    if(hand&&released&&!blockSingle){
      if(!drag){
        const at=prior||cursor;
        drag={at,last:at,time,key:hand.key,moved:false};
        commands.push({type:'down',at});
      }else if(drag.key!==hand.key){
        drag=null;
        commands.push({type:'cancel'});
      }else{
        drag.moved ||= pointGap(drag.at,cursor)>Math.max(15,Math.min(bounds.height,bounds.width)*.021);
        if(drag.moved){
          const dx=cursor.x-drag.last.x,dy=cursor.y-drag.last.y;
          if(Math.hypot(dx,dy)>1.7){
            commands.push({type:'drag',at:cursor,dx,dy});
            drag.last=cursor;
          }
        }
      }
      return {cursor,pose:'pinch',commands};
    }
    if(drag){
      const tracked=tips.some(hand=>hand.key===drag.key);
      const duration=time-drag.time;
      const tap=tracked&&!drag.moved&&!blockSingle&&duration>=65&&duration<=680;
      commands.push(tap?{type:'tap',at:drag.at}:{type:'cancel'});
      drag=null;
    }
    return {cursor,pose:'point',commands};
  }
  return {update,reset};
}
