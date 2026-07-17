import Link from 'next/link'
import { SiteFooter } from '@/components/site-footer'
import { SiteHeader } from '@/components/site-header'

const ageBands = ['0-2', '3-5', '6-9', '10-12']

export default function StoreHomePage() {
  return (
    <>
      <SiteHeader />
      <main>
        <section className="hero" aria-labelledby="hero-title">
          <p>play, grow, repeat</p>
          <h1 id="hero-title">每天都想穿上的童裝</h1>
          <p>舒服活動、自在探索，陪孩子把日常過成冒險。</p>
          <Link href="#new" className="button">看看新品</Link>
        </section>

        <section id="ages" className="section" aria-labelledby="ages-title">
          <h2 id="ages-title">依年齡找衣服</h2>
          <div className="age-links">
            {ageBands.map((ageBand) => (
              <a href="#new" key={ageBand}>{ageBand} 歲</a>
            ))}
          </div>
        </section>

        <section id="new" className="section empty-state" aria-labelledby="new-title">
          <h2 id="new-title">新品</h2>
          <p>商品準備中，第一批新品很快見面。</p>
        </section>

        <section className="section category-feature" aria-labelledby="category-title">
          <p>category</p>
          <h2 id="category-title">把好動的日子穿得更輕鬆</h2>
          <p>柔軟上衣、耐穿下著與方便搭配的日常單品。</p>
        </section>

        <section id="story" className="section brand-story" aria-labelledby="story-title">
          <p>our story</p>
          <h2 id="story-title">給孩子自在長大的空間</h2>
          <p>mori 相信每件衣服都該跟上孩子的步伐，舒服、耐穿，也保有玩心。</p>
        </section>
      </main>
      <SiteFooter />
    </>
  )
}
