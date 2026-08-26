import { useCallback, useEffect, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { io, type Socket } from 'socket.io-client'
import { chatMessagesQueryKey } from '@/hooks/useChatMessagesQuery'
import { chatsQueryKey } from '@/hooks/useChatsQuery'
import { sendMessage as sendMessageRest } from '@/services/chats.service'
import { useAuthStore } from '@/stores/auth.store'
import type {
  ChatConnectionStatus,
  ClientToServerEvents,
  MessageDTO,
  ServerToClientEvents,
} from '@/types/chat.types'

type ChatClientSocket = Socket<ServerToClientEvents, ClientToServerEvents>

// vacio => ruta relativa y proxy de vite (ver vite.config.ts)
const SOCKET_URL = import.meta.env.VITE_SOCKET_URL ?? ''

function appendMessage(current: MessageDTO[] | undefined, message: MessageDTO): MessageDTO[] {
  const previous = current ?? []
  if (previous.some((item) => item.id === message.id)) {
    return previous
  }
  return [...previous, message]
}

export function useChatSocket(chatId: number | undefined) {
  const token = useAuthStore((state) => state.token)
  const queryClient = useQueryClient()

  const [status, setStatus] = useState<ChatConnectionStatus>('connecting')
  const [error, setError] = useState<string | null>(null)
  const [activeToken, setActiveToken] = useState(token)

  // reset al cambiar de sesion, sin pasar por un efecto
  if (token !== activeToken) {
    setActiveToken(token)
    setStatus('connecting')
    setError(null)
  }

  const socketRef = useRef<ChatClientSocket | null>(null)
  const chatIdRef = useRef<number | undefined>(chatId)
  const hasConnectedRef = useRef(false)

  useEffect(() => {
    chatIdRef.current = chatId
  }, [chatId])

  useEffect(() => {
    if (!token) return

    const socket: ChatClientSocket = io(SOCKET_URL, {
      auth: { token },
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
    })
    socketRef.current = socket

    // el join_chat lo emite el efecto de abajo al pasar a conectado
    function handleConnect() {
      setStatus('connected')
      setError(null)

      const activeChatId = chatIdRef.current

      // tras una caida el historial pudo quedar desfasado
      if (hasConnectedRef.current) {
        if (activeChatId) {
          queryClient.invalidateQueries({ queryKey: chatMessagesQueryKey(activeChatId) })
        }
        queryClient.invalidateQueries({ queryKey: chatsQueryKey })
      }
      hasConnectedRef.current = true
    }

    function handleDisconnect(reason: Socket.DisconnectReason) {
      // el cliente desmontado o un kick del server no reintentan solos
      const isFinal = reason === 'io client disconnect' || reason === 'io server disconnect'
      setStatus(isFinal ? 'disconnected' : 'reconnecting')
    }

    function handleConnectError(connectError: Error) {
      setStatus('reconnecting')
      setError(connectError.message)
    }

    function handleReceiveMessage(message: MessageDTO) {
      queryClient.setQueryData<MessageDTO[]>(chatMessagesQueryKey(message.chatId), (current) =>
        appendMessage(current, message)
      )
    }

    function handleServerError(payload: { event: string; message: string }) {
      setError(payload.message)
    }

    socket.on('connect', handleConnect)
    socket.on('disconnect', handleDisconnect)
    socket.on('connect_error', handleConnectError)
    socket.on('receive_message', handleReceiveMessage)
    socket.on('error', handleServerError)

    return () => {
      socket.off('connect', handleConnect)
      socket.off('disconnect', handleDisconnect)
      socket.off('connect_error', handleConnectError)
      socket.off('receive_message', handleReceiveMessage)
      socket.off('error', handleServerError)
      socket.disconnect()
      socketRef.current = null
      hasConnectedRef.current = false
    }
  }, [token, queryClient])

  const isConnected = status === 'connected'

  useEffect(() => {
    const socket = socketRef.current
    if (!socket || !chatId || !isConnected) return

    socket.emit('join_chat', { chatId }, (response) => {
      if (!response.ok) setError(response.error)
    })

    return () => {
      if (socket.connected) {
        socket.emit('leave_chat', { chatId })
      }
    }
  }, [chatId, isConnected])

  const sendMessage = useCallback(
    async (content: string): Promise<MessageDTO> => {
      if (!chatId) {
        throw new Error('No hay un chat seleccionado')
      }

      const socket = socketRef.current
      if (!socket?.connected) {
        // sin socket el mensaje igual se persiste por REST
        const message = await sendMessageRest(chatId, content)
        queryClient.setQueryData<MessageDTO[]>(chatMessagesQueryKey(chatId), (current) =>
          appendMessage(current, message)
        )
        return message
      }

      return new Promise<MessageDTO>((resolve, reject) => {
        socket.emit('send_message', { chatId, content }, (response) => {
          if (!response.ok) {
            setError(response.error)
            reject(new Error(response.error))
            return
          }
          queryClient.setQueryData<MessageDTO[]>(chatMessagesQueryKey(chatId), (current) =>
            appendMessage(current, response.data)
          )
          resolve(response.data)
        })
      })
    },
    [chatId, queryClient]
  )

  // sin sesion no hay socket posible
  return { status: token ? status : 'disconnected', error, sendMessage }
}
