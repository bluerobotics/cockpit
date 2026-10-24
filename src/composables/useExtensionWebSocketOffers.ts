import { type ComputedRef, type Ref, computed, onScopeDispose, ref } from 'vue'

import { useBlueOsStorage } from '@/composables/settingsSyncer'
import { openSnackbar } from '@/composables/snackbar'
import { addGenericWebSocketConnection, listenToGenericWebSocketConnections } from '@/libs/generic-websocket'
import { replaceDataLakeInputsInString } from '@/libs/utils-data-lake'
import type { WebSocketOfferFromExtension } from '@/types/blueos'

/**
 * Return type of {@link useExtensionWebSocketOffers}.
 */
export interface UseExtensionWebSocketOffersReturn {
  /**
   * Connections the vehicle's extensions offer, as last read from their extras
   */
  discoveredOffers: Ref<WebSocketOfferFromExtension[]>
  /**
   * Offers the operator has neither accepted nor ignored, and that are not connected already
   */
  pendingOffers: ComputedRef<WebSocketOfferFromExtension[]>
  /**
   * Offers the operator accepted or ignored before that are not connected now, so they can still be connected
   */
  handledOffers: ComputedRef<WebSocketOfferFromExtension[]>
  /**
   * Connects to an offered WebSocket and stops offering it
   */
  acceptOffer: (offer: WebSocketOfferFromExtension) => void
  /**
   * Stops offering a WebSocket without connecting to it
   */
  ignoreOffer: (offer: WebSocketOfferFromExtension) => void
}

/**
 * WebSocket connections BlueOS extensions offer in their extras, which the operator accepts or ignores once. An
 * accepted offer becomes a generic WebSocket connection, managed from the general settings like any other.
 * @returns {UseExtensionWebSocketOffersReturn} The offers and the actions to resolve them
 */
export const useExtensionWebSocketOffers = (): UseExtensionWebSocketOffersReturn => {
  const handledOfferUrls = useBlueOsStorage<string[]>('cockpit-handled-websocket-offers', [])
  const discoveredOffers = ref<WebSocketOfferFromExtension[]>([])
  const connectedUrls = ref<string[]>([])

  const stopListening = listenToGenericWebSocketConnections((connections) => {
    connectedUrls.value = Object.keys(connections)
  })
  onScopeDispose(stopListening)

  // Compared resolved, as the connection list compares them, so a connection typed in by hand with the vehicle's
  // address counts as the offered one.
  const isConnected = (offer: WebSocketOfferFromExtension): boolean => {
    const resolvedUrl = replaceDataLakeInputsInString(offer.url)
    return connectedUrls.value.some((url) => replaceDataLakeInputsInString(url) === resolvedUrl)
  }
  const unconnectedOffers = computed(() => discoveredOffers.value.filter((offer) => !isConnected(offer)))
  const pendingOffers = computed(() =>
    unconnectedOffers.value.filter((offer) => !handledOfferUrls.value.includes(offer.url))
  )
  const handledOffers = computed(() =>
    unconnectedOffers.value.filter((offer) => handledOfferUrls.value.includes(offer.url))
  )

  const markHandled = (offer: WebSocketOfferFromExtension): void => {
    if (handledOfferUrls.value.includes(offer.url)) return
    handledOfferUrls.value = [...handledOfferUrls.value, offer.url]
  }

  const acceptOffer = (offer: WebSocketOfferFromExtension): void => {
    addGenericWebSocketConnection(offer.url)
    markHandled(offer)
    logUserAction(`Accepted the '${offer.name}' WebSocket offered by ${offer.extensionName}`)
    openSnackbar({ message: `Connecting to "${offer.name}" from ${offer.extensionName}.`, variant: 'success' })
  }

  const ignoreOffer = (offer: WebSocketOfferFromExtension): void => {
    markHandled(offer)
    logUserAction(`Ignored the '${offer.name}' WebSocket offered by ${offer.extensionName}`)
    const message = `"${offer.name}" ignored. You can still connect it from the Connections tab.`
    openSnackbar({ message, variant: 'info' })
  }

  return { discoveredOffers, pendingOffers, handledOffers, acceptOffer, ignoreOffer }
}
