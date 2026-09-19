import FairnessChart from '../components/FairnessChart.jsx'
import Screen from '../components/Screen.jsx'

export default function EvidencePage() {
  return (
    <Screen
      title="How well the triage holds up"
      lead="People describe the same symptom in very different ways. A system that calls one phrasing urgent and another routine is not safe, whatever its average accuracy looks like. This is the test we ran on that, and everything it does not prove."
    >
      <FairnessChart />
    </Screen>
  )
}
