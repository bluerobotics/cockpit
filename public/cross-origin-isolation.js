// ArduPilot SITL (sitl:// connection) runs inside Cockpit and its threads need cross-origin isolation.
// GitHub Pages can not send the headers, so the service worker adds them, only while a SITL is in use.
self.addEventListener('fetch', (event) => {
  const request = event.request
  const url = new URL(request.url)
  const isSitlNavigation =
    request.mode === 'navigate' && url.searchParams.get('MAVLink2RestWebsocketURI')?.startsWith('sitl:')
  const isSitlWorker = request.destination === 'worker' && url.pathname.includes('/sitl/')
  // An isolated page can only embed iframes that are isolated too, BlueSim is shown in an IFrame widget
  const isBlueSimNavigation = request.mode === 'navigate' && url.pathname.includes('/bluesim/')
  if (!isSitlNavigation && !isSitlWorker && !isBlueSimNavigation) return

  event.respondWith(
    fetch(request).then((response) => {
      const headers = new Headers(response.headers)
      // credentialless keeps cross-origin resources like map tiles working, but embedded pages
      // (iframe widgets, BlueOS extensions) that do not send their own COEP will not load
      headers.set('Cross-Origin-Embedder-Policy', 'credentialless')
      headers.set('Cross-Origin-Opener-Policy', 'same-origin')
      return new Response(response.body, { status: response.status, statusText: response.statusText, headers })
    })
  )
})
