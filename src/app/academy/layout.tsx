import type {Metadata} from 'next';
import './academy.css';
export const metadata:Metadata={title:'Dijital Pazarlama Akademisi',robots:{index:false,follow:false,noarchive:true},alternates:{canonical:null}};
export default function Layout({children}:{children:React.ReactNode}){return <div className="academy">{children}</div>;}
