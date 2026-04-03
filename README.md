Architecture summary
SPA flow:
Exam.renderSubjectSelection()
  → [🧪 3D Class button]
  → ThreeDClass.openForStudent()   ← hub screen
     → [Chemistry card]
     → ThreeDPeriodic.open(backFn) ← 3D table
        → [← Back]
        → backFn() = ThreeDClass._backToHub()
           → renders hub again
     → [← Back in hub]
     → ThreeDClass._close()
        → Exam.renderSubjectSelection()
No page reloads. No router changes. No broken state.
Performance choices for mobile:

CSS 3D transforms only — no Three.js, no WebGL, no heavy library
Hardware-accelerated via will-change: filter, transform on cells
Touch inertia uses requestAnimationFrame with velocity decay (not setTimeout)
Pinch zoom handled natively in touchmove
Table uses absolute positioning (no layout recalc on rotation)

To add Biology/Physics/Commerce later: in threedclass.js, set available: true on the relevant subject entry and add a launch: function pointing to the new module (e.g. ThreeDClass_Biology.open). No other code changes needed.
