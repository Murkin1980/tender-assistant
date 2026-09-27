import Link from 'next/link';

export default function LotNotFound() {
  return (
    <main className="lots-shell">
      <h1>Тендер не найден</h1>
      <p>Проверьте ссылку или выберите другой тендер.</p>
      <Link href="/lots">К списку тендеров</Link>
    </main>
  );
}
