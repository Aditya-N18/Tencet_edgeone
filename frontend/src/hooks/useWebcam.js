import { useEffect, useRef, useState } from 'react'

export function useWebcam(enabled) {
  const videoRef = useRef(null)
  const [active, setActive] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!enabled) {
      setActive(false)
      return undefined
    }

    let stream = null
    let cancelled = false

    async function start() {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: 'user',
            width: { ideal: 640 },
            height: { ideal: 480 },
          },
          audio: false,
        })

        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop())
          return
        }

        const video = videoRef.current
        if (video) {
          video.srcObject = stream
          await video.play()
        }

        setActive(true)
        setError(null)
      } catch (err) {
        setActive(false)
        setError(err.message || 'Could not access camera')
      }
    }

    start()

    return () => {
      cancelled = true
      stream?.getTracks().forEach((track) => track.stop())
      if (videoRef.current) {
        videoRef.current.srcObject = null
      }
      setActive(false)
    }
  }, [enabled])

  return { videoRef, active, error }
}
