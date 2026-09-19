import { Conversation } from '@elevenlabs/client'

export const AGENT_ID_ENV_VAR = 'VITE_ELEVENLABS_AGENT_ID'

export const VOICE_STATUS = {
  DISCONNECTED: 'disconnected',
  CONNECTING: 'connecting',
  CONNECTED: 'connected',
  DISCONNECTING: 'disconnecting',
}

export function getAgentId() {
  return String(import.meta.env.VITE_ELEVENLABS_AGENT_ID || '').trim()
}

export function isConfigured() {
  return getAgentId().length > 0
}

export async function start({
  patientId,
  patientFirstName,
  onStatusChange,
  onModeChange,
  onMessage,
  onConnect,
  onDisconnect,
  onError,
} = {}) {
  const agentId = getAgentId()
  if (!agentId) {
    throw new Error(AGENT_ID_ENV_VAR + ' is not set')
  }

  const dynamicVariables = {}
  if (patientId) dynamicVariables.patient_id = patientId
  if (patientFirstName) dynamicVariables.patient_first_name = patientFirstName

  return Conversation.startSession({
    agentId,
    dynamicVariables,
    onStatusChange: (props) => onStatusChange && onStatusChange(props.status),
    onModeChange: (props) => onModeChange && onModeChange(props.mode),
    onMessage,
    onConnect,
    onDisconnect,
    onError: (message, context) => onError && onError(message, context),
  })
}

export async function stop(conversation) {
  if (conversation) {
    await conversation.endSession()
  }
}
