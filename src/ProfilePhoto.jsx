import React,{useState} from 'react';
import {safeProfilePicture} from './profile.mjs';
import './profile.css';

export default function ProfilePhoto({user,name}){
 const [failed,setFailed]=useState(''),picture=safeProfilePicture(user?.picture);
 return picture&&picture!==failed?<img className="profile-photo" src={picture} alt="รูปโปรไฟล์" referrerPolicy="no-referrer" onError={()=>setFailed(picture)}/>:<>{Array.from(user?.name??name??'D')[0]||'D'}</>;
}
