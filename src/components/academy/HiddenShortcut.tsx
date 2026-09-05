'use client';
import {useEffect} from 'react';
import {advanceShortcut} from '@/lib/academy/shortcut';
export function HiddenShortcut(){
 useEffect(()=>{let state={position:0,time:0};const reset=()=>{state={position:0,time:0};};const key=(e:KeyboardEvent)=>{
 if(e.target instanceof Element&&e.target.closest('input,textarea,select,[contenteditable="true"]'))return;
 const result=advanceShortcut(state,e,performance.now());state=result.state;
 if(result.state.position||result.open)e.preventDefault();
 if(result.open)window.location.assign('/academy/login');
 };window.addEventListener('keydown',key);window.addEventListener('blur',reset);return()=>{window.removeEventListener('keydown',key);window.removeEventListener('blur',reset);};},[]);return null;
}
