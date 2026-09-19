import FairnessChart from '../components/FairnessChart.jsx'
import Screen from '../components/Screen.jsx'

export default function SafetyPage() {
  return (
    <Screen
      title="Safety"
      lead="How the triage behaves when the same symptom is described in different ways, and what that test does not prove."
    >
      <FairnessChart />
    </Screen>
  )
}
