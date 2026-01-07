"use client"

import { useState, useEffect, useRef } from "react"

interface Cell {
  plant: string | null
  zombie: string | null
  zombieHP: number
  projectile: boolean
}

interface Zombie {
  row: number
  col: number
  hp: number
  speed: number
}

export default function PlantsVsZombies() {
  const [gameState, setGameState] = useState({
    sun: 150,
    score: 0,
    selectedPlant: null as string | null,
    isGameOver: false,
    playerName: "",
    gameStarted: false,
  })
  const [showLeaderboard, setShowLeaderboard] = useState(false)
  const [leaderboard, setLeaderboard] = useState<Array<{ name: string; score: number }>>([])
  const [grid, setGrid] = useState<Cell[][]>(() =>
    Array.from({ length: 5 }, () =>
      Array.from({ length: 9 }, () => ({ plant: null, zombie: null, zombieHP: 0, projectile: false })),
    ),
  )
  const [zombies, setZombies] = useState<Zombie[]>([])
  const gameLoopRef = useRef<number>()
  const sunIntervalRef = useRef<number>()
  const lastSpawnRef = useRef<number>(0)
  const lastShotRef = useRef<number>(0)

  useEffect(() => {
    loadLeaderboard()
  }, [])

  useEffect(() => {
    if (gameState.gameStarted && !gameState.isGameOver) {
      startGameLoop()
      return () => {
        if (gameLoopRef.current) cancelAnimationFrame(gameLoopRef.current)
        if (sunIntervalRef.current) clearInterval(sunIntervalRef.current)
      }
    }
  }, [gameState.gameStarted, gameState.isGameOver])

  const loadLeaderboard = () => {
    try {
      const saved = localStorage.getItem("pvz_leaderboard")
      if (saved) {
        setLeaderboard(JSON.parse(saved))
      }
    } catch (e) {
      console.error("Failed to load leaderboard", e)
    }
  }

  const saveScore = (name: string, score: number) => {
    const newEntry = { name, score }
    const updated = [...leaderboard, newEntry].sort((a, b) => b.score - a.score).slice(0, 10)
    setLeaderboard(updated)
    localStorage.setItem("pvz_leaderboard", JSON.stringify(updated))
  }

  const startGameLoop = () => {
    // Generate sun periodically
    sunIntervalRef.current = window.setInterval(() => {
      setGameState((prev) => ({ ...prev, sun: prev.sun + 25 }))
      // Sunflowers generate sun
      setGrid((prevGrid) => {
        const newGrid = prevGrid.map((row) => row.map((cell) => ({ ...cell })))
        prevGrid.forEach((row, rowIndex) => {
          row.forEach((cell) => {
            if (cell.plant === "sunflower") {
              setGameState((prev) => ({ ...prev, sun: prev.sun + 25 }))
            }
          })
        })
        return newGrid
      })
    }, 8000)

    let lastTime = Date.now()

    const gameLoop = () => {
      const now = Date.now()
      const deltaTime = now - lastTime
      lastTime = now

      // Spawn zombies
      if (now - lastSpawnRef.current > 5000) {
        if (Math.random() < 0.6) {
          const row = Math.floor(Math.random() * 5)
          setZombies((prev) => [...prev, { row, col: 8.5, hp: 10, speed: 0.01 }])
        }
        lastSpawnRef.current = now
      }

      // Move zombies
      setZombies((prevZombies) => {
        const updated = prevZombies.map((zombie) => ({
          ...zombie,
          col: zombie.col - zombie.speed * deltaTime,
        }))

        // Check for game over
        const hasReachedEnd = updated.some((z) => z.col <= 0)
        if (hasReachedEnd) {
          handleGameOver()
        }

        return updated.filter((z) => z.col > 0 && z.hp > 0)
      })

      // Shoot projectiles
      if (now - lastShotRef.current > 1500) {
        setGrid((prevGrid) => {
          const newGrid = prevGrid.map((row) => row.map((cell) => ({ ...cell, projectile: false })))

          prevGrid.forEach((row, rowIndex) => {
            row.forEach((cell, colIndex) => {
              if (cell.plant === "peashooter") {
                // Check if there's a zombie in this row
                const hasZombieInRow = zombies.some((z) => Math.floor(z.col) <= 8 && z.row === rowIndex)
                if (hasZombieInRow) {
                  newGrid[rowIndex][colIndex].projectile = true
                }
              }
            })
          })

          return newGrid
        })
        lastShotRef.current = now
      }

      // Move projectiles and check collisions
      setGrid((prevGrid) => {
        const newGrid = prevGrid.map((row) => row.map((cell) => ({ ...cell })))

        prevGrid.forEach((row, rowIndex) => {
          row.forEach((cell, colIndex) => {
            if (cell.projectile) {
              // Check for zombie collision
              setZombies((prevZombies) => {
                return prevZombies.map((zombie) => {
                  if (zombie.row === rowIndex && Math.floor(zombie.col) === colIndex) {
                    const newHp = zombie.hp - 3
                    if (newHp <= 0) {
                      setGameState((prev) => ({ ...prev, score: prev.score + 10 }))
                    }
                    return { ...zombie, hp: newHp }
                  }
                  return zombie
                })
              })
            }
          })
        })

        return newGrid
      })

      // Check zombie-plant collisions
      setGrid((prevGrid) => {
        const newGrid = prevGrid.map((row) => row.map((cell) => ({ ...cell })))

        zombies.forEach((zombie) => {
          const col = Math.floor(zombie.col)
          if (col >= 0 && col < 9 && prevGrid[zombie.row][col].plant) {
            newGrid[zombie.row][col].plant = null
            setZombies((prev) => prev.filter((z) => z !== zombie))
          }
        })

        return newGrid
      })

      gameLoopRef.current = requestAnimationFrame(gameLoop)
    }
    gameLoop()
  }

  const handlePlantSelect = (plantType: string, cost: number) => {
    if (gameState.sun >= cost) {
      setGameState((prev) => ({ ...prev, selectedPlant: plantType }))
    }
  }

  const handleCellClick = (row: number, col: number) => {
    if (!gameState.gameStarted) return

    if (gameState.selectedPlant === "shovel") {
      if (grid[row][col].plant) {
        setGrid((prevGrid) => {
          const newGrid = prevGrid.map((r) => r.map((c) => ({ ...c })))
          newGrid[row][col].plant = null
          return newGrid
        })
      }
      setGameState((prev) => ({ ...prev, selectedPlant: null }))
    } else if (gameState.selectedPlant && !grid[row][col].plant) {
      const cost = gameState.selectedPlant === "sunflower" ? 50 : 100
      if (gameState.sun >= cost) {
        setGrid((prevGrid) => {
          const newGrid = prevGrid.map((r) => r.map((c) => ({ ...c })))
          newGrid[row][col].plant = gameState.selectedPlant
          return newGrid
        })
        setGameState((prev) => ({
          ...prev,
          sun: prev.sun - cost,
          selectedPlant: null,
        }))
      }
    }
  }

  const handleGameOver = () => {
    if (gameLoopRef.current) cancelAnimationFrame(gameLoopRef.current)
    if (sunIntervalRef.current) clearInterval(sunIntervalRef.current)
    setGameState((prev) => ({ ...prev, isGameOver: true, gameStarted: false }))
  }

  const handleNameSubmit = () => {
    if (gameState.playerName.trim()) {
      saveScore(gameState.playerName, gameState.score)
      setGameState((prev) => ({ ...prev, playerName: "" }))
      setShowLeaderboard(true)
    }
  }

  const resetGame = () => {
    setGameState({ sun: 150, score: 0, selectedPlant: null, isGameOver: false, playerName: "", gameStarted: true })
    setGrid(
      Array.from({ length: 5 }, () =>
        Array.from({ length: 9 }, () => ({ plant: null, zombie: null, zombieHP: 0, projectile: false })),
      ),
    )
    setZombies([])
    lastSpawnRef.current = 0
    lastShotRef.current = 0
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-green-400 to-green-600 p-4 md:p-8">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-4xl md:text-5xl font-bold text-white text-center mb-6 md:mb-8 drop-shadow-lg text-balance">
          Plants vs Zombies
        </h1>

        {!gameState.gameStarted && !gameState.isGameOver ? (
          <div className="flex flex-col items-center justify-center min-h-[400px] bg-white/90 rounded-xl shadow-2xl p-8">
            <h2 className="text-3xl font-bold mb-4 text-green-700">Vítejte!</h2>
            <p className="text-lg mb-8 text-center text-gray-700">Braňte svůj dům před zombíky pomocí rostlin</p>
            <button
              onClick={() => setGameState((prev) => ({ ...prev, gameStarted: true }))}
              className="px-8 py-4 bg-green-600 text-white rounded-lg font-bold text-xl hover:bg-green-700 transition shadow-lg"
            >
              Začít hru
            </button>
            <button
              onClick={() => setShowLeaderboard(true)}
              className="mt-4 px-6 py-3 bg-purple-600 text-white rounded-lg font-bold hover:bg-purple-700 transition"
            >
              🏆 Zobrazit tabulku vítězů
            </button>
          </div>
        ) : (
          <>
            {/* Game Info */}
            <div className="flex flex-wrap gap-4 justify-between mb-6 bg-white/90 p-4 rounded-lg shadow-lg">
              <div className="text-xl md:text-2xl font-bold text-yellow-600">☀️ Slunce: {gameState.sun}</div>
              <div className="text-xl md:text-2xl font-bold text-green-700">🎯 Skóre: {gameState.score}</div>
              <button
                onClick={() => setShowLeaderboard(!showLeaderboard)}
                className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition text-sm md:text-base"
              >
                🏆 Tabulka vítězů
              </button>
            </div>

            {/* Plant Selection */}
            <div className="flex flex-wrap gap-3 md:gap-4 mb-6 bg-white/90 p-4 rounded-lg shadow-lg">
              <button
                onClick={() => handlePlantSelect("sunflower", 50)}
                disabled={gameState.sun < 50}
                className={`px-4 md:px-6 py-2 md:py-3 rounded-lg font-bold transition text-sm md:text-base ${
                  gameState.sun >= 50
                    ? "bg-yellow-400 hover:bg-yellow-500 text-yellow-900"
                    : "bg-gray-300 text-gray-500 cursor-not-allowed"
                } ${gameState.selectedPlant === "sunflower" ? "ring-4 ring-blue-500" : ""}`}
              >
                🌻 Slunečnice (50)
              </button>
              <button
                onClick={() => handlePlantSelect("peashooter", 100)}
                disabled={gameState.sun < 100}
                className={`px-4 md:px-6 py-2 md:py-3 rounded-lg font-bold transition text-sm md:text-base ${
                  gameState.sun >= 100
                    ? "bg-green-400 hover:bg-green-500 text-green-900"
                    : "bg-gray-300 text-gray-500 cursor-not-allowed"
                } ${gameState.selectedPlant === "peashooter" ? "ring-4 ring-blue-500" : ""}`}
              >
                🌱 Hráškostřel (100)
              </button>
              <button
                onClick={() => setGameState((prev) => ({ ...prev, selectedPlant: "shovel" }))}
                className={`px-4 md:px-6 py-2 md:py-3 bg-gray-600 hover:bg-gray-700 text-white rounded-lg font-bold transition text-sm md:text-base ${
                  gameState.selectedPlant === "shovel" ? "ring-4 ring-blue-500" : ""
                }`}
              >
                🔨 Lopata
              </button>
            </div>

            {/* Game Grid */}
            <div className="grid grid-cols-9 gap-1 md:gap-2 bg-green-800/50 p-2 md:p-4 rounded-lg shadow-2xl mb-6">
              {grid.map((row, rowIndex) =>
                row.map((cell, colIndex) => {
                  const zombieInCell = zombies.find((z) => z.row === rowIndex && Math.floor(z.col) === colIndex)
                  return (
                    <div
                      key={`${rowIndex}-${colIndex}`}
                      onClick={() => handleCellClick(rowIndex, colIndex)}
                      className="aspect-square bg-green-600/80 border-2 border-green-700 rounded cursor-pointer hover:bg-green-500/80 transition flex items-center justify-center text-2xl md:text-4xl relative"
                    >
                      {cell.plant && <span className="absolute">{cell.plant === "sunflower" ? "🌻" : "🌱"}</span>}
                      {zombieInCell && <span className="absolute">🧟</span>}
                      {cell.projectile && <span className="absolute text-lg">●</span>}
                    </div>
                  )
                }),
              )}
            </div>
          </>
        )}

        {/* Leaderboard Modal */}
        {showLeaderboard && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl p-6 md:p-8 max-w-md w-full shadow-2xl">
              <h2 className="text-2xl md:text-3xl font-bold text-center mb-6 text-purple-700">🏆 Tabulka vítězů</h2>
              <div className="space-y-2 mb-6 max-h-96 overflow-y-auto">
                {leaderboard.length === 0 ? (
                  <p className="text-center text-gray-500">Zatím žádné záznamy</p>
                ) : (
                  leaderboard.map((entry, index) => (
                    <div
                      key={index}
                      className="flex justify-between p-3 bg-gradient-to-r from-purple-100 to-pink-100 rounded-lg"
                    >
                      <span className="font-bold text-purple-800">
                        {index + 1}. {entry.name}
                      </span>
                      <span className="font-bold text-pink-700">{entry.score} bodů</span>
                    </div>
                  ))
                )}
              </div>
              <button
                onClick={() => setShowLeaderboard(false)}
                className="w-full py-3 bg-purple-600 text-white rounded-lg font-bold hover:bg-purple-700 transition"
              >
                Zavřít
              </button>
            </div>
          </div>
        )}

        {/* Game Over Modal */}
        {gameState.isGameOver && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl p-6 md:p-8 max-w-md w-full shadow-2xl">
              <h2 className="text-2xl md:text-3xl font-bold text-center mb-4 text-red-700">Konec hry!</h2>
              <p className="text-center text-xl md:text-2xl mb-6">
                Vaše skóre: <span className="font-bold text-green-700">{gameState.score}</span>
              </p>
              <input
                type="text"
                value={gameState.playerName}
                onChange={(e) => setGameState((prev) => ({ ...prev, playerName: e.target.value }))}
                onKeyDown={(e) => e.key === "Enter" && handleNameSubmit()}
                placeholder="Zadejte své jméno"
                className="w-full p-3 border-2 border-gray-300 rounded-lg mb-4 text-lg"
              />
              <button
                onClick={handleNameSubmit}
                disabled={!gameState.playerName.trim()}
                className="w-full py-3 bg-green-600 text-white rounded-lg font-bold hover:bg-green-700 transition disabled:bg-gray-300 disabled:cursor-not-allowed mb-2"
              >
                Uložit skóre
              </button>
              <button
                onClick={resetGame}
                className="w-full py-3 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 transition"
              >
                Hrát znovu
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
