import styles from "../styles/Home.module.css";

export default function Home() {
  return (
    <div className={styles.container}>
      <main className={styles.main}>
        <h1 className={styles.title}>
          <span className={styles.title_packing}>U</span>ndefined
        </h1>
        <p className={styles.description}>tatsuroro | Tatsuro Nakamura</p>
      </main>

      <section>
        <div className={styles.section_title}>
          <span className={styles.tape}>About</span>
        </div>
        <div className={styles.section_body}>
          <p>
            Tatsuro Nakamura is a software developer living in Fukuoka, Japan.
          </p>
          <h3>Skills</h3>
          <ul>
            <li>TypeScript, JavaScript</li>
            <li>Web Frontend Application Structure</li>
            <li>UI, Interaction design</li>
            <li>Facilitate, Coaching</li>
          </ul>
          <h3>Experience</h3>
          <ul>
            <li>Ubie, Inc. (2020-)</li>
            <li>LINE Growth Technology Corporation (2019-2020)</li>
            <li>Kaizen Platform, Inc. (2015-2019)</li>
            <li>CyberAgent, Inc. (2012-2015)</li>
            <li>
              Amateur scriptwriter and stage director / Web designer (2005-2011)
            </li>
          </ul>
        </div>
      </section>
      <section>
        <div className={styles.section_title}>
          <span className={styles.tape}>Activities</span>
        </div>
        <div className={styles.section_body}>
          <p>
            <a href="https://tatsuroro.hateblo.jp/">Blog</a>
          </p>
          <p>
            <a href="https://github.com/tatsuroro">GitHub</a>
          </p>
          <p>
            <a href="https://twitter.com/tatsuroro">Twitter</a>
          </p>
          <p>
            <a href="https://www.facebook.com/tatsuro.nk">Facebook</a>
          </p>
        </div>
      </section>
      <footer>
        &copy; tatsuroro.com
      </footer>
    </div>
  );
}
