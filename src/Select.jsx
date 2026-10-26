import React,{useState,useRef,useEffect,Children,isValidElement} from 'react';
import {ChevronDown,Check} from 'lucide-react';

const optionsOf=children=>Children.toArray(children).flatMap(c=>!isValidElement(c)?[]:c.type==='option'?[{value:String(c.props.value??c.props.children),label:c.props.children,disabled:c.props.disabled}]:optionsOf(c.props.children));
// Rounded drop-in replacement for <select>: same value/onChange contract, so callers keep reading e.target.value.
export default function Select({value,onChange,children,className='','aria-label':label,disabled,required}){
 const options=optionsOf(children),[open,setOpen]=useState(false),[active,setActive]=useState(0),ref=useRef();
 const current=options.find(o=>o.value===String(value))??options[0];
 useEffect(()=>{if(!open)return;const close=e=>{if(!ref.current?.contains(e.target))setOpen(false);};document.addEventListener('pointerdown',close);return ()=>document.removeEventListener('pointerdown',close);},[open]);
 // Inside a <label>, a click on the menu would also re-click the trigger button and reopen the list, so cancel that default.
 const pick=(o,event)=>{event?.preventDefault();if(o.disabled)return;onChange?.({target:{value:o.value},currentTarget:{value:o.value}});setOpen(false);};
 const key=e=>{if(e.key==='Escape')setOpen(false);else if(['ArrowDown','ArrowUp'].includes(e.key)){e.preventDefault();if(!open){setOpen(true);setActive(Math.max(0,options.indexOf(current)));}else setActive(i=>(i+(e.key==='ArrowDown'?1:-1)+options.length)%options.length);}else if((e.key==='Enter'||e.key===' ')&&open){e.preventDefault();pick(options[active]);}};
 return <div ref={ref} className={`ui-select ${open?'open':''} ${className}`}>
  <button type="button" className="ui-select-trigger" aria-haspopup="listbox" aria-expanded={open} aria-label={label} aria-required={required} disabled={disabled} onClick={()=>{setOpen(!open);setActive(Math.max(0,options.indexOf(current)));}} onKeyDown={key}><span>{current?.label}</span><ChevronDown size={16}/></button>
  {open&&<ul className="ui-select-menu" role="listbox">{options.map((o,i)=><li key={o.value} role="option" aria-selected={o===current} className={`${i===active?'active':''} ${o.disabled?'disabled':''}`} onPointerEnter={()=>setActive(i)} onClick={e=>pick(o,e)}><span>{o.label}</span>{o===current&&<Check size={15}/>}</li>)}</ul>}
 </div>;
}
