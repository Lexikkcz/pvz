"use client"

import { useState, useEffect, useRef } from "react"

interface Plant {
  type: string
  hp: number
  maxHp: number
  icon: string
  lastSunTime: number
  lastShootTime: number
}

interface Zombie {
  row: number
  x: number
  hp: number
  maxHp: number
  eating: boolean
  eatingPlantCol: number | null
}

interface Projectile {
  row: number
  x: number
  y: number
  damage: number
  onFire: boolean
}

interface FallingSun {
  id: number
  x: number
}

export default function PlantsVsZombies() {
  const ROWS = 5
  const COLS = 9
  const CELL_SIZE = 90

  const [sun, setSun] = useState(150)
  const [score, setScore] = useState(0)
  const [selectedPlant, setSelectedPlant] = useState<string | null>(null)
  const [shovelMode, setShovelMode] = useState(false)
  const [gameRunning, setGameRunning] = useState(false)
  const [grid, setGrid] = useState<(Plant | null)[][]>([])
  const [zombies, setZombies] = useState<Zombie[]>([])
  const [projectiles, setProjectiles] = useState<Projectile[]>([])
  const [fallingSuns, setFallingSuns] = useState<FallingSun[]>([])
  const [gameTime, setGameTime] = useState(0)
  const [plantCooldowns, setPlantCooldowns] = useState<Record<string, number>>({})
  const [gameOver, setGameOver] = useState(false)
  const [playerName, setPlayerName] = useState("")
  const [leaderboard, setLeaderboard] = useState<Array<{ name: string; score: number; time: string }>>([])
  const [showLeaderboard, setShowLeaderboard] = useState(false)

  const startTimeRef = useRef<number>(0)
  const gameLoopRef = useRef<NodeJS.Timeout | null>(null)
  const zombieTimerRef = useRef<NodeJS.Timeout | null>(null)
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const sunDropRef = useRef<NodeJS.Timeout | null>(null)
  const difficultyRef = useRef<NodeJS.Timeout | null>(null)
  const currentZombieLimitRef = useRef(1)
  const spawnIntervalRef = useRef(20000)

  const PLANTS = {
    sunflower: { cost: 50, hp: 300, type: "sunflower", icon: "🌻", cooldown: 7500 },
    peashooter: { cost: 100, hp: 300, type: "peashooter", icon: "🌿", cooldown: 7500 },
    torchwood: { cost: 175, hp: 400, type: "torchwood", icon: "🪵", cooldown: 30000 },
  }

  useEffect(() => {
    loadLeaderboard()
  }, [])

  useEffect(() => {
    if (gameRunning) {
      startGame()
    }
    return () => {
      if (gameLoopRef.current) clearInterval(gameLoopRef.current)
      if (zombieTimerRef.current) clearTimeout(zombieTimerRef.current)
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current)
      if (sunDropRef.current) clearInterval(sunDropRef.current)
      if (difficultyRef.current) clearInterval(difficultyRef.current)
    }
  }, [gameRunning])

  const initGame = () => {
    setGrid(
      Array(ROWS)
        .fill(null)
        .map(() => Array(COLS).fill(null)),
    )
    setZombies([])
    setProjectiles([])
    setFallingSuns([])
    setSun(150)
    setScore(0)
    setGameTime(0)
    setSelectedPlant(null)
    setShovelMode(false)
    setPlantCooldowns({})
    currentZombieLimitRef.current = 1
    spawnIntervalRef.current = 20000
    setGameOver(false)
    setGameRunning(true)
  }

  const startGame = () => {
    startTimeRef.current = Date.now()

    gameLoopRef.current = setInterval(() => {
      updateGame()
    }, 50)

    timerIntervalRef.current = setInterval(() => {
      const elapsed = Math.floor((Date.now() - startTimeRef.current) / 1000)
      setGameTime(elapsed)
    }, 1000)

    sunDropRef.current = setInterval(() => {
      dropSun()
    }, 10000)

    difficultyRef.current = setInterval(() => {
      if (currentZombieLimitRef.current < 4) {
        currentZombieLimitRef.current++
      }
      if (spawnIntervalRef.current > 8000) {
        spawnIntervalRef.current -= 2000
      }
    }, 30000)

    scheduleNextZombie()
  }

  const scheduleNextZombie = () => {
    zombieTimerRef.current = setTimeout(() => {
      spawnZombie()
      if (gameRunning) scheduleNextZombie()
    }, spawnIntervalRef.current)
  }

  const dropSun = () => {
    const x = Math.random() * (COLS * CELL_SIZE - 50) + 25
    const sunId = Date.now() + Math.random()
    setFallingSuns((prev) => [...prev, { id: sunId, x }])

    setTimeout(() => {
      setFallingSuns((prev) => prev.filter((s) => s.id !== sunId))
    }, 8000)
  }

  const collectSun = (sunId: number) => {
    setSun((prev) => prev + 25)
    setFallingSuns((prev) => prev.filter((s) => s.id !== sunId))
  }

  const spawnZombie = () => {
    setZombies((prev) => {
      if (prev.length >= currentZombieLimitRef.current) return prev
      const row = Math.floor(Math.random() * ROWS)
      return [
        ...prev,
        {
          row,
          x: COLS * CELL_SIZE + 20,
          hp: 200,
          maxHp: 200,
          eating: false,
          eatingPlantCol: null,
        },
      ]
    })
  }

  const updateGame = () => {
    updateSunflowers()
    updatePeashooters()
    updateProjectiles()
    updateZombies()
  }

  const updateSunflowers = () => {
    const now = Date.now()
    setGrid((prevGrid) => {
      const newGrid = prevGrid.map((row) => row.map((cell) => (cell ? { ...cell } : null)))
      newGrid.forEach((row) => {
        row.forEach((cell) => {
          if (cell && cell.type === "sunflower") {
            if (now - cell.lastSunTime > 24000) {
              setSun((prev) => prev + 25)
              cell.lastSunTime = now
            }
          }
        })
      })
      return newGrid
    })
  }

  const updatePeashooters = () => {
    const now = Date.now()
    setGrid((prevGrid) => {
      const newGrid = prevGrid.map((row) => row.map((cell) => (cell ? { ...cell } : null)))
      newGrid.forEach((row, rowIdx) => {
        row.forEach((cell, colIdx) => {
          if (cell && cell.type === "peashooter") {
            const hasZombie = zombies.some((z) => z.row === rowIdx)
            if (hasZombie && now - cell.lastShootTime > 1400) {
              setProjectiles((prev) => [
                ...prev,
                {
                  row: rowIdx,
                  x: (colIdx + 1) * CELL_SIZE,
                  y: rowIdx * CELL_SIZE + CELL_SIZE / 2,
                  damage: 20,
                  onFire: false,
                },
              ])
              cell.lastShootTime = now
            }
          }
        })
      })
      return newGrid
    })
  }

  const updateProjectiles = () => {
    setProjectiles((prevProj) => {
      return prevProj
        .map((proj) => {
          const newProj = { ...proj, x: proj.x + 5 }

          if (!newProj.onFire) {
            const col = Math.floor(newProj.x / CELL_SIZE)
            if (col >= 0 && col < COLS) {
              const plant = grid[newProj.row]?.[col]
              if (plant && plant.type === "torchwood") {
                newProj.onFire = true
                newProj.damage = 40
              }
            }
          }

          return newProj
        })
        .filter((proj) => {
          let hit = false
          setZombies((prevZombies) => {
            return prevZombies
              .map((zombie) => {
                if (zombie.row === proj.row && Math.abs(zombie.x - proj.x) < 40) {
                  hit = true
                  const newHp = zombie.hp - proj.damage
                  if (newHp <= 0) {
                    setScore((prev) => prev + 100)
                    return null
                  }
                  return { ...zombie, hp: newHp }
                }
                return zombie
              })
              .filter((z) => z !== null) as Zombie[]
          })
          if (hit) return false
          return proj.x < COLS * CELL_SIZE + 200
        })
    })
  }

  const updateZombies = () => {
    setZombies((prevZombies) => {
      const newZombies = prevZombies.map((zombie) => {
        const newZombie = { ...zombie }
        const col = Math.floor(newZombie.x / CELL_SIZE)

        if (col >= 0 && col < COLS) {
          const plant = grid[newZombie.row]?.[col]
          if (plant && newZombie.x < (col + 0.85) * CELL_SIZE && newZombie.x > (col + 0.2) * CELL_SIZE) {
            newZombie.eating = true
            newZombie.eatingPlantCol = col

            setGrid((prevGrid) => {
              const newGrid = prevGrid.map((row) => row.map((cell) => (cell ? { ...cell } : null)))
              const plantCell = newGrid[newZombie.row][col]
              if (plantCell) {
                plantCell.hp -= 3
                if (plantCell.hp <= 0) {
                  newGrid[newZombie.row][col] = null
                  newZombie.eating = false
                  newZombie.eatingPlantCol = null
                }
              }
              return newGrid
            })
          } else {
            newZombie.eating = false
            newZombie.eatingPlantCol = null
          }
        }

        if (!newZombie.eating) {
          newZombie.x -= 0.35
        }

        if (newZombie.x < -50) {
          endGame()
        }

        return newZombie
      })

      return newZombies
    })
  }

  const selectPlant = (type: string) => {
    const plant = PLANTS[type as keyof typeof PLANTS]
    const now = Date.now()

    if (plantCooldowns[type] && now < plantCooldowns[type]) {
      return
    }

    if (sun >= plant.cost) {
      setShovelMode(false)
      setSelectedPlant(type)
    }
  }

  const selectShovel = () => {
    setShovelMode(true)
    setSelectedPlant(null)
  }

  const handleCellClick = (row: number, col: number) => {
    if (!gameRunning) return

    if (shovelMode) {
      if (grid[row][col]) {
        setGrid((prevGrid) => {
          const newGrid = prevGrid.map((r) => r.map((c) => (c ? { ...c } : null)))
          newGrid[row][col] = null
          return newGrid
        })
        setShovelMode(false)
      }
      return
    }

    if (selectedPlant && !grid[row][col]) {
      const plant = PLANTS[selectedPlant as keyof typeof PLANTS]
      const now = Date.now()

      if (plantCooldowns[selectedPlant] && now < plantCooldowns[selectedPlant]) {
        return
      }

      if (sun >= plant.cost) {
        setGrid((prevGrid) => {
          const newGrid = prevGrid.map((r) => r.map((c) => (c ? { ...c } : null)))
          newGrid[row][col] = {
            type: plant.type,
            hp: plant.hp,
            maxHp: plant.hp,
            icon: plant.icon,
            lastSunTime: Date.now(),
            lastShootTime: Date.now(),
          }
          return newGrid
        })

        setSun((prev) => prev - plant.cost)

        setPlantCooldowns((prev) => ({
          ...prev,
          [selectedPlant]: now + plant.cooldown,
        }))

        setTimeout(() => {
          setPlantCooldowns((prev) => {
            const newCooldowns = { ...prev }
            delete newCooldowns[selectedPlant]
            return newCooldowns
          })
        }, plant.cooldown)

        setSelectedPlant(null)
      }
    }
  }

  const endGame = () => {
    setGameRunning(false)
    setGameOver(true)
    if (gameLoopRef.current) clearInterval(gameLoopRef.current)
    if (zombieTimerRef.current) clearTimeout(zombieTimerRef.current)
    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current)
    if (sunDropRef.current) clearInterval(sunDropRef.current)
    if (difficultyRef.current) clearInterval(difficultyRef.current)
    loadLeaderboard()
  }

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

  const saveScore = () => {
    if (!playerName.trim()) {
      alert("Prosím zadej své jméno!")
      return
    }

    const minutes = Math.floor(gameTime / 60)
    const seconds = gameTime % 60
    const timeStr = `${minutes}:${seconds.toString().padStart(2, "0")}`

    const newEntry = { name: playerName, score, time: timeStr }
    const updated = [...leaderboard, newEntry].sort((a, b) => b.score - a.score).slice(0, 10)
    setLeaderboard(updated)
    localStorage.setItem("pvz_leaderboard", JSON.stringify(updated))
    alert("Skóre úspěšně uloženo! 🎉")
    setPlayerName("")
  }

  const restartGame = () => {
    setGameOver(false)
    setPlayerName("")
    initGame()
  }

  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${minutes}:${secs.toString().padStart(2, "0")}`
  }

  if (!gameRunning && !gameOver) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-sky-400 to-green-400">
        <div className="text-center bg-white/90 p-12 rounded-3xl shadow-2xl">
          <h1 className="text-6xl font-bold mb-6 text-green-700">Plants vs Zombies</h1>
          <p className="text-2xl mb-8 text-gray-700">Obrana zahrady</p>
          <button
            onClick={initGame}
            className="px-12 py-4 bg-green-600 text-white text-2xl font-bold rounded-xl hover:bg-green-700 transition shadow-lg mb-4"
          >
            🎮 Začít hru
          </button>
          <button
            onClick={() => {
              loadLeaderboard()
              setShowLeaderboard(true)
            }}
            className="block mx-auto px-8 py-3 bg-purple-600 text-white text-xl font-bold rounded-xl hover:bg-purple-700 transition"
          >
            🏆 Tabulka vítězů
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-sky-400 to-green-400 overflow-hidden">
      <style jsx>{`
        @keyframes sunFall {
          0% {
            top: -50px;
          }
          100% {
            top: 100vh;
          }
        }
        @keyframes zombieEat {
          0%,
          100% {
            transform: translateX(0);
          }
          50% {
            transform: translateX(-5px);
          }
        }
        @keyframes flame {
          0% {
            transform: translateX(-50%) scaleY(1);
          }
          100% {
            transform: translateX(-50%) scaleY(1.2);
          }
        }
        .falling-sun {
          position: fixed;
          font-size: 32px;
          cursor: pointer;
          animation: sunFall 8s linear;
          z-index: 100;
          transition: transform 0.2s;
        }
        .falling-sun:hover {
          transform: scale(1.3);
        }
        .zombie-eating {
          animation: zombieEat 0.5s infinite;
        }
        .torchwood-flame::before {
          content: "";
          position: absolute;
          top: -10px;
          left: 50%;
          transform: translateX(-50%);
          width: 30px;
          height: 40px;
          background: linear-gradient(to top, transparent, rgba(255, 140, 0, 0.6));
          border-radius: 50% 50% 0 0;
          animation: flame 0.5s infinite alternate;
        }
        .peashooter-custom {
          position: relative;
          width: 60px;
          height: 60px;
          background: radial-gradient(circle at 30% 30%, #90ee90, #228b22);
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .peashooter-custom::before {
          content: "";
          position: absolute;
          right: -15px;
          top: 50%;
          transform: translateY(-50%);
          width: 20px;
          height: 15px;
          background: linear-gradient(to right, #228b22, #90ee90);
          border-radius: 0 50% 50% 0;
        }
        .peashooter-custom::after {
          content: "👁️";
          position: absolute;
          font-size: 20px;
          top: 15px;
          left: 15px;
        }
        .projectile-normal {
          width: 14px;
          height: 14px;
          background: radial-gradient(circle, #90ee90, #228b22);
          border-radius: 50%;
          box-shadow: 0 0 10px #90ee90;
        }
        .projectile-fire {
          width: 14px;
          height: 14px;
          background: radial-gradient(circle, #ff8c00, #ff4500);
          border-radius: 50%;
          box-shadow: 0 0 15px #ff8c00;
        }
      `}</style>

      <div className="bg-green-800 text-white px-6 py-4 flex justify-between items-center shadow-lg">
        <div className="bg-yellow-400 text-gray-900 px-6 py-3 rounded-xl text-2xl font-bold flex items-center gap-3">
          <span>☀️</span>
          <span>{sun}</span>
        </div>
        <div className="flex gap-8 text-xl">
          <div className="text-yellow-300">Čas: {formatTime(gameTime)}</div>
          <div>Skóre: {score}</div>
        </div>
      </div>

      <div className="px-4 py-4 flex gap-4 flex-wrap">
        <button
          onClick={() => selectPlant("sunflower")}
          disabled={sun < 50 || !!plantCooldowns.sunflower}
          className={`px-6 py-4 rounded-xl font-bold text-lg transition flex items-center gap-3 ${
            sun >= 50 && !plantCooldowns.sunflower
              ? "bg-green-400 border-4 border-green-700 hover:bg-lime-400"
              : "bg-gray-400 border-4 border-gray-600 opacity-50 cursor-not-allowed"
          } ${selectedPlant === "sunflower" ? "ring-4 ring-yellow-400" : ""}`}
        >
          <span className="text-4xl">🌻</span>
          <span>
            Slunečnice
            <br />
            (50 ☀️)
          </span>
        </button>
        <button
          onClick={() => selectPlant("peashooter")}
          disabled={sun < 100 || !!plantCooldowns.peashooter}
          className={`px-6 py-4 rounded-xl font-bold text-lg transition flex items-center gap-3 ${
            sun >= 100 && !plantCooldowns.peashooter
              ? "bg-green-400 border-4 border-green-700 hover:bg-lime-400"
              : "bg-gray-400 border-4 border-gray-600 opacity-50 cursor-not-allowed"
          } ${selectedPlant === "peashooter" ? "ring-4 ring-yellow-400" : ""}`}
        >
          <span className="text-4xl">🌿</span>
          <span>
            Peashooter
            <br />
            (100 ☀️)
          </span>
        </button>
        <button
          onClick={() => selectPlant("torchwood")}
          disabled={sun < 175 || !!plantCooldowns.torchwood}
          className={`px-6 py-4 rounded-xl font-bold text-lg transition flex items-center gap-3 ${
            sun >= 175 && !plantCooldowns.torchwood
              ? "bg-green-400 border-4 border-green-700 hover:bg-lime-400"
              : "bg-gray-400 border-4 border-gray-600 opacity-50 cursor-not-allowed"
          } ${selectedPlant === "torchwood" ? "ring-4 ring-yellow-400" : ""}`}
        >
          <span className="text-4xl">🪵</span>
          <span>
            Hořící kmen
            <br />
            (175 ☀️)
          </span>
        </button>
        <button
          onClick={selectShovel}
          className={`px-6 py-4 rounded-xl font-bold text-lg transition flex items-center gap-3 bg-amber-700 border-4 border-amber-900 hover:bg-amber-600 ${
            shovelMode ? "ring-4 ring-yellow-400" : ""
          }`}
        >
          <span className="text-4xl">🪓</span>
          <span>
            Lopata
            <br />
            (odebrat)
          </span>
        </button>
      </div>

      <div
        className="relative mx-auto my-6 bg-green-400/30 border-8 border-green-700 rounded-2xl shadow-2xl"
        style={{
          width: COLS * CELL_SIZE + "px",
          height: ROWS * CELL_SIZE + "px",
          display: "grid",
          gridTemplateColumns: `repeat(${COLS}, ${CELL_SIZE}px)`,
          gridTemplateRows: `repeat(${ROWS}, ${CELL_SIZE}px)`,
        }}
      >
        {grid.map((row, rowIdx) =>
          row.map((cell, colIdx) => (
            <div
              key={`${rowIdx}-${colIdx}`}
              onClick={() => handleCellClick(rowIdx, colIdx)}
              className="border-2 border-green-700/30 bg-white/10 hover:bg-white/30 cursor-pointer flex items-center justify-center relative transition"
            >
              {cell && (
                <div className="relative flex flex-col items-center justify-center">
                  {cell.type === "peashooter" ? (
                    <div className="peashooter-custom">
                      <div className="absolute bottom-2 left-1/2 -translate-x-1/2 w-8 h-2 bg-gray-300 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-red-500 via-orange-500 to-green-500 rounded-full transition-all"
                          style={{ width: `${(cell.hp / cell.maxHp) * 100}%` }}
                        />
                      </div>
                    </div>
                  ) : (
                    <>
                      <span className={`text-7xl relative ${cell.type === "torchwood" ? "torchwood-flame" : ""}`}>
                        {cell.icon}
                      </span>
                      <div className="absolute bottom-2 left-1/2 -translate-x-1/2 w-16 h-2 bg-gray-300 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-red-500 via-orange-500 to-green-500 rounded-full transition-all"
                          style={{ width: `${(cell.hp / cell.maxHp) * 100}%` }}
                        />
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          )),
        )}

        {zombies.map((zombie, idx) => (
          <div
            key={idx}
            className={`absolute text-6xl z-10 ${zombie.eating ? "zombie-eating" : ""}`}
            style={{
              left: zombie.x + "px",
              top: zombie.row * CELL_SIZE + 15 + "px",
            }}
          >
            🧟
          </div>
        ))}

        {projectiles.map((proj, idx) => (
          <div
            key={idx}
            className={`absolute z-5 ${proj.onFire ? "projectile-fire" : "projectile-normal"}`}
            style={{
              left: proj.x + "px",
              top: proj.y + "px",
            }}
          />
        ))}
      </div>

      {fallingSuns.map((sun) => (
        <div key={sun.id} className="falling-sun" style={{ left: sun.x + "px" }} onClick={() => collectSun(sun.id)}>
          ☀️
        </div>
      ))}

      {gameOver && (
        <div className="fixed inset-0 bg-black/85 flex items-center justify-center z-50">
          <div className="bg-white p-12 rounded-3xl text-center max-w-lg shadow-2xl">
            <h2 className="text-5xl font-bold mb-6 text-gray-800">💀 Konec hry</h2>
            <p className="text-3xl mb-3">
              Skóre: <strong className="text-green-600">{score}</strong>
            </p>
            <p className="text-2xl mb-6">
              Čas přežití: <strong className="text-blue-600">{formatTime(gameTime)}</strong>
            </p>
            <input
              type="text"
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && saveScore()}
              placeholder="Zadej své jméno"
              maxLength={20}
              className="w-full p-4 text-xl border-4 border-green-600 rounded-xl mb-6"
            />
            <div className="flex gap-4">
              <button
                onClick={saveScore}
                className="flex-1 py-4 bg-green-600 text-white text-xl font-bold rounded-xl hover:bg-green-700 transition"
              >
                💾 Uložit skóre
              </button>
              <button
                onClick={restartGame}
                className="flex-1 py-4 bg-blue-600 text-white text-xl font-bold rounded-xl hover:bg-blue-700 transition"
              >
                🔄 Hrát znovu
              </button>
            </div>
            <div className="mt-8">
              <h3 className="text-2xl font-bold mb-4 text-purple-700">🏆 Tabulka vítězů</h3>
              {leaderboard.length === 0 ? (
                <p className="text-gray-500">Zatím žádné skóre</p>
              ) : (
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {leaderboard.map((entry, idx) => (
                    <div key={idx} className="bg-gray-100 p-3 rounded-lg flex justify-between items-center">
                      <div>
                        <strong className="text-green-700">
                          {idx + 1}. {entry.name}
                        </strong>
                      </div>
                      <div className="text-right">
                        <strong>{entry.score} bodů</strong>
                        <br />
                        <small className="text-gray-600">Čas: {entry.time}</small>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {showLeaderboard && !gameOver && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white p-10 rounded-3xl max-w-md shadow-2xl">
            <h2 className="text-3xl font-bold text-center mb-6 text-purple-700">🏆 Tabulka vítězů</h2>
            {leaderboard.length === 0 ? (
              <p className="text-center text-gray-500 mb-6">Zatím žádné skóre</p>
            ) : (
              <div className="space-y-2 mb-6 max-h-96 overflow-y-auto">
                {leaderboard.map((entry, idx) => (
                  <div
                    key={idx}
                    className="bg-gradient-to-r from-purple-100 to-pink-100 p-4 rounded-lg flex justify-between"
                  >
                    <div>
                      <strong className="text-purple-800">
                        {idx + 1}. {entry.name}
                      </strong>
                    </div>
                    <div className="text-right">
                      <strong className="text-pink-700">{entry.score} bodů</strong>
                      <br />
                      <small className="text-gray-600">{entry.time}</small>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <button
              onClick={() => setShowLeaderboard(false)}
              className="w-full py-3 bg-purple-600 text-white text-xl font-bold rounded-xl hover:bg-purple-700 transition"
            >
              Zavřít
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
