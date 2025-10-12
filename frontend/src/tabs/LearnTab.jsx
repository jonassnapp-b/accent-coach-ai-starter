// src/tabs/LearnTab.jsx
import React from "react";

const units = [
  {
    id: "u1",
    title: "Section 1 • Unit 1",
    name: "Basics",
    lessons: [
      { id: "l1", title: "Greetings",    status: "done"    },
      { id: "l2", title: "Alphabet",     status: "done"    },
      { id: "l3", title: "Numbers",      status: "current" },
      { id: "l4", title: "Introduce",    status: "locked"  },
    ],
  },
  {
    id: "u2",
    title: "Section 1 • Unit 2",
    name: "Pronunciation",
    lessons: [
      { id: "l1", title: "Vowels",       status: "locked"  },
      { id: "l2", title: "Consonants",   status: "locked"  },
      { id: "l3", title: "Word Stress",  status: "locked"  },
    ],
  },
];

function LessonNode({ lesson }) {
  const common = {
    width: 64, height: 64, borderRadius: 16,
    display: "grid", placeItems: "center", fontWeight: 700
  };

  if (lesson.status === "done") {
    return (
      <div title={lesson.title} style={{...common, background:"#e7f8ec", border:"2px solid #8ad9a1"}}>
        ✓
      </div>
    );
  }
  if (lesson.status === "current") {
    return (
      <button title={lesson.title} className="btn"
        style={{
          ...common, background:"#fffbe6", border:"2px solid #ffd666",
          cursor:"pointer"
        }}
        onClick={()=>alert("This is a placeholder. You’ll add course content later.")}
      >
        START
      </button>
    );
  }
  return (
    <div title={lesson.title} style={{...common, background:"#f3f3f3", border:"2px dashed #ddd", color:"#bbb"}}>
      🔒
    </div>
  );
}

export default function LearnTab() {
  return (
    <div className="panel">
      <h2>Learn</h2>

      <div style={{display:"grid", gap:24}}>
        {units.map((u) => (
          <div key={u.id} className="card">
            <div style={{display:"flex", justifyContent:"space-between", alignItems:"baseline", marginBottom:12}}>
              <div style={{fontSize:12, opacity:0.7}}>{u.title}</div>
              <div style={{fontWeight:700}}>{u.name}</div>
            </div>

            <div style={{
              display:"grid",
              gridTemplateColumns:"repeat(auto-fit, minmax(72px, 1fr))",
              gap:16,
              alignItems:"center"
            }}>
              {u.lessons.map((l, idx) => (
                <div key={l.id} style={{display:"grid", justifyItems:"center", gap:6}}>
                  <LessonNode lesson={l} />
                  <div style={{fontSize:12, textAlign:"center"}}>{l.title}</div>
                  {/* “sti”/linje mellem noder */}
                  {idx < u.lessons.length - 1 && (
                    <div style={{height:2, background:"#eee", width:"80%", justifySelf:"center"}}/>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <p style={{marginTop:16, fontSize:12, opacity:0.7}}>
        Placeholder UI. You’ll plug in real course data and XP awarding later.
      </p>
    </div>
  );
}
