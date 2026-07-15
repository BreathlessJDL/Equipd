const url = 'https://www.technogym.com/en-GB/product/skillmill_DJK0.html'
const agents = [
  'EquipdIntelligenceBot/1.0 (admin market sync POC)',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
]

for (const ua of agents) {
  const res = await fetch(url, {
    headers: { 'User-Agent': ua, Accept: 'text/html' },
    redirect: 'follow',
  })
  const text = await res.text()
  const pounds = [...text.matchAll(/(?:from\s*£|£)\s*[\d,]+(?:\.\d{2})?/gi)].slice(0, 8).map((m) => m[0])
  console.log('UA:', ua.slice(0, 50))
  console.log('  status:', res.status, 'bytes:', text.length)
  console.log('  GBP amounts:', pounds.join(' | ') || 'none')
  const nextData = text.includes('__NEXT_DATA__') || text.includes('application/json')
  console.log('  has embedded JSON/state:', nextData)
}
