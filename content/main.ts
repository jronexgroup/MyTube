import { intercept } from './intercept'
import { installH264ify } from './h264ify'
import { installClickbaitThumbnails } from './clickbait'
import { injectCSS } from './css'
import { initNouTube } from './noutube'
import { handleMutations, handleVideoPlayer } from './player'
import { emit } from './utils'
import { handleDialogs } from './dialogs'
import { handleMenu } from './menu'
import { pinchToZoom } from './pinch'
import { installBlocklistFilter } from './blocklist'
import { installDislikeCount } from './dislikes'
import { installCommentTranslateButtons } from './translate'
import { interceptClipboard } from './clipboard'
import { installWatchNavigation } from './watch-nav'
import { installFullscreenControls } from './fullscreen-controls'
import { installSystemCaptionStyle } from './captions'
import { installEncodedAuthorNameFix } from './author-names'
import { guardMediaSessionHandlers, installBackgroundGuard } from './background-guard'
import { installSplitView, navigateWatch, setMuted, setNativeMini } from './split-view'

try {
  if ((window as any).NouTubePreferH264) {
    installH264ify()
  }

  const clickbaitTarget = (window as any).NouTubeClickbaitThumbnail
  if (clickbaitTarget && clickbaitTarget !== 'default') {
    installClickbaitThumbnails(clickbaitTarget)
  }

  // Before anything of YouTube's runs: it registers the Media Session handlers
  // that carry a headphone or lock screen press while its early scripts run,
  // and the guard has to have wrapped them by then.
  if (window.isAndroid) {
    guardMediaSessionHandlers()
  }

  window.NouTube = initNouTube()
  ;(window.NouTube as any).setMuted = setMuted
  ;(window.NouTube as any).setNativeMini = setNativeMini
  ;(window.NouTube as any).navigateWatch = navigateWatch
  interceptClipboard()
  installWatchNavigation()
  installSplitView()

  if (!window.electron) {
    intercept()
  }

  if (document.documentElement) {
    injectCSS()
    installSystemCaptionStyle()
    emit('onload')
    initObserver()
  } else {
    document.addEventListener('DOMContentLoaded', () => {
      injectCSS()
      installSystemCaptionStyle()
      emit('onload')
      initObserver()
    })
  }

  // YouTube pauses playback with a "Continue watching?" prompt once _lact goes
  // stale for hours. Refreshing it every minute keeps the session active for
  // the whole background playback, not just the first prompt interval.
  setInterval(() => (window._lact = Date.now()), 60 * 1000)
} catch (e) {
  console.error('NouScript: ', e)
}

async function initObserver() {
  const player = document.querySelector('#movie_player')
  if (player) {
    handleVideoPlayer(player)
  }
  const observer = new MutationObserver((mutations) => {
    // YouTube swaps #movie_player out on its own, so watching only until the
    // first one is found would leave progress unrecorded for the rest of the
    // session. handleVideoPlayer ignores an element it has already bound.
    handleMutations(mutations)
    handleDialogs()
  })
  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
  })

  handleMenu()
  installBlocklistFilter()
  installDislikeCount()
  installTripleTapGestures()
  installFullscreenControls()
  installCommentTranslateButtons()
  installEncodedAuthorNameFix()
  if (window.isAndroid) {
    installBackgroundGuard()
  }

  pinchToZoom()
}

function installTripleTapGestures() {
  if (!window.isAndroid) {
    return
  }

  const root = window as Window & typeof globalThis & { __noutubeTripleTapGesturesInit?: boolean }
  if (root.__noutubeTripleTapGesturesInit) {
    return
  }
  root.__noutubeTripleTapGesturesInit = true

  const EDGE_SIZE = 96
  const TAP_INTERVAL_MS = 450
  const TAP_DISTANCE = 72

  let tapCount = 0
  let lastTapAt = 0
  let lastTapX = 0
  let lastTapY = 0
  let multiTouchSequence = false

  // YouTube uses double-tap inside the player to seek ±10s, so never steal it there.
  const isIgnored = (target: Element) =>
    Boolean(
      target.closest(
        'input, textarea, select, button, a, video, audio, [contenteditable="true"], [role="button"],' +
          '#movie_player, .html5-video-player, #player, #player-container-id, ytm-player, ytd-player, #shorts-player',
      ),
    )

  const isFullscreen = () =>
    Boolean(document.fullscreenElement || (document as any).webkitFullscreenElement)

  document.addEventListener(
    'touchstart',
    (event) => {
      if (event.touches.length > 1) multiTouchSequence = true
    },
    { passive: true, capture: true },
  )

  document.addEventListener(
    'touchend',
    (event) => {
      if (multiTouchSequence) {
        if (event.touches.length === 0) multiTouchSequence = false
        return
      }
      if (event.changedTouches.length !== 1) return
      // In fullscreen the toolbar is hidden anyway and the player owns taps.
      if (isFullscreen()) {
        tapCount = 0
        return
      }

      const touch = event.changedTouches[0]
      const nearEdge = touch.clientY <= EDGE_SIZE || touch.clientY >= window.innerHeight - EDGE_SIZE
      if (!nearEdge) {
        tapCount = 0
        return
      }

      const now = Date.now()
      const dx = touch.clientX - lastTapX
      const dy = touch.clientY - lastTapY
      const continued = now - lastTapAt <= TAP_INTERVAL_MS && dx * dx + dy * dy <= TAP_DISTANCE * TAP_DISTANCE
      tapCount = continued ? tapCount + 1 : 1
      lastTapAt = now
      lastTapX = touch.clientX
      lastTapY = touch.clientY

      if (tapCount < 3) return
      tapCount = 0
      lastTapAt = 0

      const eventTarget = event.target instanceof Element ? event.target : null
      const target = eventTarget || document.elementFromPoint(touch.clientX, touch.clientY)
      if (!target || isIgnored(target)) return
      const settings = window.NouTube?.getSettings?.()
      if (settings?.tripleTapToToggleHeader) {
        event.preventDefault()
        emit('header-triple-tap')
      }
    },
    { passive: false, capture: true },
  )
}
