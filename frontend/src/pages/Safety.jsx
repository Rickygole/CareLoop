import FairnessChart from '../components/FairnessChart.jsx'
import Screen from '../components/Screen.jsx'

export default function SafetyPage() {
  return (
    <Screen
      title="Safety"
      lead="This page is the test record. It shows how CareLoop rates the same symptom when it is described in different ways, and what that test does not prove."
    >
      <FairnessChart />
    </Screen>
  )
}
