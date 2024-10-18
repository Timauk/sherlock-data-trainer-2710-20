import React, { useState, useEffect, useCallback } from 'react';
import { useTheme } from 'next-themes';
import DataUploader from '@/components/DataUploader';
import GameControls from '@/components/GameControls';
import GameBoard from '@/components/GameBoard';
import LogDisplay from '@/components/LogDisplay';
import { Progress } from "@/components/ui/progress";
import { useGameLogic } from '@/hooks/useGameLogic';

const PlayPage: React.FC = () => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [csvData, setCsvData] = useState<number[][]>([]);
  const [csvDates, setCsvDates] = useState<Date[]>([]);
  const [trainedModel, setTrainedModel] = useState<tf.LayersModel | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const { theme, setTheme } = useTheme();

  const {
    players,
    generation,
    evolutionData,
    boardNumbers,
    concursoNumber,
    setGeneration,
    setEvolutionData,
    setBoardNumbers,
    initializePlayers,
    gameLoop,
    evolveGeneration
  } = useGameLogic(csvData, trainedModel);

  useEffect(() => {
    initializePlayers();
  }, [initializePlayers]);

  const addLog = useCallback((message: string) => {
    setLogs(prevLogs => [...prevLogs, message]);
  }, []);

  const loadCSV = async (file: File) => {
    try {
      const text = await file.text();
      const lines = text.trim().split('\n').slice(1); // Ignorar o cabeçalho
      const data = lines.map(line => {
        const values = line.split(',');
        return {
          concurso: parseInt(values[0], 10),
          data: new Date(values[1].split('/').reverse().join('-')),
          bolas: values.slice(2).map(Number)
        };
      });
      setCsvData(data.map(d => d.bolas));
      setCsvDates(data.map(d => d.data));
      setBoardNumbers(data[0].bolas);
      setConcursoNumber(data[0].concurso);
      addLog("CSV carregado e processado com sucesso!");
      addLog(`Número de registros carregados: ${data.length}`);
    } catch (error) {
      addLog(`Erro ao carregar CSV: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
    }
  };

  const loadModel = async (jsonFile: File, weightsFile: File) => {
    try {
      const model = await tf.loadLayersModel(tf.io.browserFiles([jsonFile, weightsFile]));
      setTrainedModel(model);
      addLog("Modelo carregado com sucesso!");
    } catch (error) {
      addLog(`Erro ao carregar o modelo: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
      console.error("Detalhes do erro:", error);
    }
  };

  const playGame = useCallback(() => {
    if (!trainedModel || csvData.length === 0) {
      addLog("Não é possível iniciar o jogo. Verifique se o modelo e os dados CSV foram carregados.");
      return;
    }
    setIsPlaying(true);
    addLog("Jogo iniciado.");
    gameLoop(addLog);
  }, [trainedModel, csvData, gameLoop, addLog]);

  const pauseGame = () => {
    setIsPlaying(false);
    addLog("Jogo pausado.");
  };

  const resetGame = () => {
    setIsPlaying(false);
    setGeneration(1);
    setProgress(0);
    setEvolutionData([]);
    setBoardNumbers([]);
    initializePlayers();
    setLogs([]);
    addLog("Jogo reiniciado.");
  };

  useEffect(() => {
    let intervalId: NodeJS.Timeout;
    if (isPlaying) {
      intervalId = setInterval(() => {
        const currentIndex = Math.floor(progress / 100 * csvData.length);
        if (currentIndex < csvData.length) {
          setBoardNumbers(csvData[currentIndex]);
          setConcursoNumber(currentIndex + 1); // Assumindo que o primeiro concurso é 1
          setProgress((prevProgress) => {
            const newProgress = prevProgress + (100 / csvData.length);
            if (newProgress >= 100) {
              evolveGeneration();
              return 0;
            }
            return newProgress;
          });
          gameLoop(addLog);
        } else {
          setIsPlaying(false);
          addLog("Todos os concursos foram processados.");
        }
      }, 1000);
    }
    return () => clearInterval(intervalId);
  }, [isPlaying, csvData, progress, gameLoop, addLog, evolveGeneration, setBoardNumbers]);

  return (
    <div className="p-6">
      <h2 className="text-2xl font-bold mb-4 neon-title">SHERLOK</h2>
      
      <DataUploader onCsvUpload={loadCSV} onModelUpload={loadModel} />

      <GameControls
        isPlaying={isPlaying}
        onPlay={playGame}
        onPause={pauseGame}
        onReset={resetGame}
        onThemeToggle={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
      />

      <div className="mb-4">
        <h3 className="text-lg font-semibold mb-2">Progresso da Geração {generation}</h3>
        <Progress value={progress} className="w-full" />
      </div>

      <GameBoard
        boardNumbers={boardNumbers}
        concursoNumber={concursoNumber}
        players={players}
        evolutionData={evolutionData}
      />
      
      <LogDisplay logs={logs} />
    </div>
  );
};

export default PlayPage;
