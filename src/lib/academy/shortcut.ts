export type ShortcutState={position:number;time:number};
export function advanceShortcut(state:ShortcutState,event:{code:string;metaKey:boolean;ctrlKey:boolean;shiftKey:boolean;altKey:boolean;repeat:boolean},time:number):{state:ShortcutState;open:boolean}{
 if(event.repeat||['MetaLeft','MetaRight','ControlLeft','ControlRight','ShiftLeft','ShiftRight'].includes(event.code)) return {state,open:false};
 if(!(event.metaKey||event.ctrlKey)||!event.shiftKey||event.altKey) return {state:{position:0,time},open:false};
 const sequence=['Digit1','Digit1','Digit2'];const position=time-state.time>1500?0:state.position;
 const next=event.code===sequence[position]?position+1:event.code==='Digit1'?1:0;
 return {state:{position:next===3?0:next,time},open:next===3};
}
