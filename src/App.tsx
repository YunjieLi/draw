import { useEffect, useState } from "react"

import Home from "@/pages/Home"
import Mandala from "@/pages/Mandala"

function useHashRoute() {
  const [route, setRoute] = useState(
    () => window.location.hash.replace(/^#/, "") || "/"
  )

  useEffect(() => {
    const onChange = () =>
      setRoute(window.location.hash.replace(/^#/, "") || "/")
    window.addEventListener("hashchange", onChange)
    return () => window.removeEventListener("hashchange", onChange)
  }, [])

  return route
}

function App() {
  const route = useHashRoute()

  switch (route) {
    case "/mandala":
      return <Mandala />
    default:
      return <Home />
  }
}

export default App
