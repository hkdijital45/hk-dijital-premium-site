'use client';
export default function ErrorPage({reset}:{reset:()=>void}){return <section className="academy ac-card" role="alert"><h1>Çalışma alanı yüklenemedi.</h1><p>Veritabanı bağlantısı veya içerik yüklemesi başarısız oldu. Kaydedilmiş verileriniz hesabınızda kalır.</p><button className="ac-button" onClick={reset}>Tekrar dene</button></section>;}
