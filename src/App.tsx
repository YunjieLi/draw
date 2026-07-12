import { useEffect, useState } from "react"

import { AuthProvider } from "@/lib/auth"
import FreeForm from "@/pages/FreeForm"
import Gallery from "@/pages/Gallery"
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

function Routes() {
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
    case "/gallery":
      return <Gallery />
    default:
      return <Home />
  }
}

function App() {
  return (
    <AuthProvider>
      <Routes />
    </AuthProvider>
  )
}

export default App
