import { useEffect, useState } from "react"

import FreeForm from "@/pages/FreeForm"
import Home from "@/pages/Home"
import Mandala from "@/pages/Mandala"
import Mirror from "@/pages/Mirror"
import Tiles from "@/pages/Tiles"

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
    case "/free-form":
      return <FreeForm />
    case "/mandala":
      return <Mandala />
    case "/tiles":
      return <Tiles />
    case "/mirror":
      return <Mirror />
    default:
      return <Home />
  }
}

export default App
