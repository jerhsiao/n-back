import React, { useState, useReducer, useEffect, useRef, useCallback, useMemo } from 'react';
import './App.css';

// Reducer for complex state logic (removed saved test actions)
const testReducer = (state, action) => {
  switch (action.type) {
    case 'START_TEST':
      return {
        ...state,
        isRunning: true,
        isPaused: false,
        isComplete: false,
        currentTrial: 0,
        currentPosition: null,
        viewingResults: false,
        errorMessage: ""
      };
    case 'PAUSE_TEST':
      return {
        ...state,
        isPaused: true
      };
    case 'RESUME_TEST':
      return {
        ...state,
        isPaused: false
      };
    case 'STOP_TEST':
      return {
        ...state,
        isRunning: false,
        isPaused: false,
        isComplete: true,
        currentPosition: null
      };
    case 'SHOW_POSITION':
      return {
        ...state,
        currentTrial: action.payload.trialIndex,
        currentPosition: action.payload.position
      };
    case 'CLEAR_POSITION':
      return {
        ...state,
        currentPosition: null
      };
    case 'SET_ERROR':
      return {
        ...state,
        errorMessage: action.payload
      };
    case 'VIEW_RESULTS':
      return {
        ...state,
        viewingResults: true
      };
    case 'RESET_TEST':
      return {
        ...state,
        isRunning: false,
        isPaused: false,
        isComplete: false,
        viewingResults: false,
        currentTrial: 0,
        currentPosition: null,
        errorMessage: ""
      };
    default:
      return state;
  }
};

// Reducer for test data
const dataReducer = (state, action) => {
  switch (action.type) {
    case 'SET_POSITIONS':
      return {
        ...state,
        positions: action.payload
      };
    case 'ADD_RESPONSE':
      const updatedRespondedTrials = new Set(state.respondedTrials);
      updatedRespondedTrials.add(action.payload.trial);
      return {
        ...state,
        responses: [...state.responses, action.payload],
        respondedTrials: updatedRespondedTrials
      };
    case 'LOG_EVENT':
      return {
        ...state,
        detailedLog: [...state.detailedLog, action.payload]
      };
    case 'UPDATE_RESULTS':
      const { type, reactionTime } = action.payload;
      const newResults = { ...state.results };
      switch (type) {
        case 'hit':
          newResults.hits++;
          newResults.reactionTimes = [...(newResults.reactionTimes || []), reactionTime];
          break;
        case 'miss':
          newResults.misses++;
          break;
        case 'falseAlarm':
          newResults.falseAlarms++;
          break;
        case 'correctReject':
          newResults.correctRejects++;
          break;
        default:
          break;
      }
      return {
        ...state,
        results: newResults
      };
    case 'CALCULATE_RESULTS':
      const { hits, misses, falseAlarms, correctRejects, reactionTimes } = state.results;
      const totalTrials = hits + misses + falseAlarms + correctRejects;
      const accuracy = totalTrials > 0 ? Math.round(((hits + correctRejects) / totalTrials) * 100) : 0;
      const averageRT = reactionTimes?.length
        ? Math.round(reactionTimes.reduce((sum, rt) => sum + rt, 0) / reactionTimes.length)
        : 0;
      const endTime = new Date();
      const completedTrials = action.payload.completedTrials || 0;
      return {
        ...state,
        results: {
          ...state.results,
          accuracy,
          averageRT,
          totalMatchTrials: hits + misses,
          totalNonMatchTrials: falseAlarms + correctRejects,
          completedTrials,
          endTime,
          duration: (endTime - action.payload.startTime) / 1000
        }
      };
    case 'RESET_DATA':
      return {
        positions: [],
        responses: [],
        detailedLog: [],
        respondedTrials: new Set(),
        results: {
          hits: 0,
          misses: 0,
          falseAlarms: 0,
          correctRejects: 0,
          accuracy: 0,
          averageRT: 0,
          completedTrials: 0,
          ...action.payload
        }
      };
    default:
      return state;
  }
};

// Custom hook for N-Back test logic
function useNBackTest(config) {
  const { nBack, secondsPerTrial, matchPercentage, totalTrials, showFeedback } = config;
  
  const [testState, dispatch] = useReducer(testReducer, {
    isRunning: false,
    isPaused: false,
    isComplete: false,
    currentTrial: 0,
    currentPosition: null,
    viewingResults: false,
    errorMessage: ""
  });
  
  const [testData, dispatchData] = useReducer(dataReducer, {
    positions: [],
    responses: [],
    detailedLog: [],
    respondedTrials: new Set(),
    results: {
      hits: 0,
      misses: 0,
      falseAlarms: 0,
      correctRejects: 0,
      accuracy: 0,
      averageRT: 0
    }
  });
  
  // Refs for non-rendered data
  const timerRef = useRef(null);
  const errorTimerRef = useRef(null);
  const positionsRef = useRef([]);
  const trialStartTimeRef = useRef(null);
  const trialTimestampsRef = useRef([]);
  const responseAllowedRef = useRef(true);
  const testInfoRef = useRef({ testId: null, startTime: null });
  const respondedTrialsRef = useRef(testData.respondedTrials);
  useEffect(() => {
    respondedTrialsRef.current = testData.respondedTrials;
  }, [testData.respondedTrials]);
  
  // Ref for remaining time when pausing a trial
  const remainingTimeRef = useRef(null);
  
  // New ref to track if the test is running
  const isRunningRef = useRef(testState.isRunning);
  useEffect(() => {
    isRunningRef.current = testState.isRunning;
  }, [testState.isRunning]);
  
  const { isRunning, isPaused, currentTrial } = testState;
  const { responses, detailedLog, results } = testData;
  
  const formatTime = useCallback((date) => {
    return date.toLocaleTimeString([], { 
      hour: '2-digit', minute: '2-digit', second: '2-digit', fractionalSecondDigits: 3 
    });
  }, []);
  
  const formatDate = useCallback((date) => {
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }, []);
  
  const isPositionMatch = useCallback((currentIndex) => {
    if (currentIndex < nBack) return false;
    return positionsRef.current[currentIndex] === positionsRef.current[currentIndex - nBack];
  }, [nBack]);
  
  const setError = useCallback((message) => {
    if (errorTimerRef.current) clearTimeout(errorTimerRef.current);
    dispatch({ type: 'SET_ERROR', payload: message });
    if (message) {
      errorTimerRef.current = setTimeout(() => {
        dispatch({ type: 'SET_ERROR', payload: "" });
      }, 3000);
    }
  }, []);
  
  const generateSequence = useCallback(() => {
    const newPositions = [];
    const newTimestamps = [];
    for (let i = 0; i < nBack; i++) {
      const randomPosition = Math.floor(Math.random() * 9);
      newPositions.push(randomPosition);
      newTimestamps.push(null);
    }
    const remainingTrials = totalTrials - nBack;
    const targetMatches = Math.round((remainingTrials * matchPercentage) / 100);
    let matchesCreated = 0;
    for (let i = nBack; i < totalTrials; i++) {
      const shouldMatch = matchesCreated < targetMatches && Math.random() < (targetMatches - matchesCreated) / (totalTrials - i);
      if (shouldMatch) {
        newPositions.push(newPositions[i - nBack]);
        newTimestamps.push(null);
        matchesCreated++;
      } else {
        let randomPosition;
        do {
          randomPosition = Math.floor(Math.random() * 9);
        } while (randomPosition === newPositions[i - nBack]);
        newPositions.push(randomPosition);
        newTimestamps.push(null);
      }
    }
    positionsRef.current = newPositions;
    trialTimestampsRef.current = newTimestamps;
    dispatchData({ type: 'SET_POSITIONS', payload: newPositions });
    return newPositions;
  }, [nBack, totalTrials, matchPercentage]);
  
  const logEvent = useCallback((trialNum, eventType, position, isMatch, correct = null, reactionTime = null) => {
    const currentTime = new Date();
    dispatchData({ 
      type: 'LOG_EVENT', 
      payload: { trial: trialNum, time: formatTime(currentTime), event: eventType, position, isMatch, correct, reactionTime }
    });
    return currentTime;
  }, [formatTime]);
  
  const addResponse = useCallback((trial, isResponse, isMatch, correct, reactionTime = null) => {
    const responseTime = new Date();
    const newResponse = {
      trial,
      time: responseTime,
      position: positionsRef.current[trial],
      isMatch,
      isResponse,
      correct,
      reactionTime
    };
    dispatchData({ type: 'ADD_RESPONSE', payload: newResponse });
    return newResponse;
  }, []);
  
  const updateResults = useCallback((type, reactionTime = null) => {
    dispatchData({ type: 'UPDATE_RESULTS', payload: { type, reactionTime } });
  }, []);
  
  const calculateResults = useCallback(() => {
    dispatchData({ 
      type: 'CALCULATE_RESULTS', 
      payload: { startTime: testInfoRef.current.startTime, completedTrials: currentTrial + 1 }
    });
  }, [currentTrial]);
  
  const endTest = useCallback(() => {
    clearTimeout(timerRef.current);
    dispatch({ type: 'STOP_TEST' });
    calculateResults();
  }, [calculateResults]);
  
  // In showPosition, check if the test is still running via isRunningRef.
  const showPosition = useCallback((trialIndex, delay = secondsPerTrial * 1000) => {
    if (!isRunningRef.current) return;
    if (trialIndex >= positionsRef.current.length) {
      endTest();
      return;
    }
    responseAllowedRef.current = true;
    const currentTime = new Date();
    trialTimestampsRef.current[trialIndex] = currentTime;
    logEvent(trialIndex + 1, "TRIAL_START", positionsRef.current[trialIndex], isPositionMatch(trialIndex));
    dispatch({ type: 'SHOW_POSITION', payload: { trialIndex, position: positionsRef.current[trialIndex] } });
    trialStartTimeRef.current = performance.now();
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      if (!isRunningRef.current) return; // Stop if test is no longer running.
      const thisTrialIsMatch = isPositionMatch(trialIndex);
      const userResponded = respondedTrialsRef.current.has(trialIndex);
      if (trialIndex >= nBack && thisTrialIsMatch && !userResponded) {
        addResponse(trialIndex, false, true, false);
        logEvent(trialIndex + 1, "MISS", positionsRef.current[trialIndex], true, false);
        updateResults('miss');
        if (showFeedback) setError(`Missed! This position matches the one from ${nBack} trials ago.`);
      } else if (trialIndex >= nBack && !thisTrialIsMatch && !userResponded) {
        logEvent(trialIndex + 1, "CORRECT_REJECT", positionsRef.current[trialIndex], false, true);
        updateResults('correctReject');
      }
      dispatch({ type: 'CLEAR_POSITION' });
      responseAllowedRef.current = false;
      logEvent(trialIndex + 1, "TRIAL_END", positionsRef.current[trialIndex], isPositionMatch(trialIndex));
      setTimeout(() => {
        if (isRunningRef.current) {
          showPosition(trialIndex + 1);
        }
      }, 500);
    }, delay);
  }, [secondsPerTrial, nBack, showFeedback, isPositionMatch, logEvent, addResponse, updateResults, endTest, setError]);
  
  const handleResponse = useCallback(() => {
    if (!isRunning || isPaused || !responseAllowedRef.current) return;
    const reactionTime = Math.round(performance.now() - trialStartTimeRef.current);
    const thisTrialIsMatch = isPositionMatch(currentTrial);
    dispatchData({ 
      type: 'ADD_RESPONSE', 
      payload: {
        trial: currentTrial,
        time: new Date(),
        position: positionsRef.current[currentTrial],
        isMatch: thisTrialIsMatch,
        isResponse: true,
        correct: thisTrialIsMatch && currentTrial >= nBack,
        reactionTime
      } 
    });
    if (currentTrial < nBack) {
      logEvent(currentTrial + 1, "FALSE_ALARM", positionsRef.current[currentTrial], false, false, reactionTime);
      updateResults('falseAlarm');
      if (showFeedback) setError(`FALSE ALARM! The first ${nBack} trials can't be matches.`);
      return;
    }
    if (thisTrialIsMatch) {
      logEvent(currentTrial + 1, "HIT", positionsRef.current[currentTrial], true, true, reactionTime);
      updateResults('hit', reactionTime);
    } else {
      logEvent(currentTrial + 1, "FALSE_ALARM", positionsRef.current[currentTrial], false, false, reactionTime);
      updateResults('falseAlarm');
      if (showFeedback) setError(`FALSE ALARM! This position does not match the one from ${nBack} trials ago.`);
    }
  }, [isRunning, isPaused, currentTrial, nBack, isPositionMatch, showFeedback, logEvent, updateResults, setError]);
  
  const startTest = useCallback(() => {
    generateSequence();
    const testId = Date.now().toString();
    const startTime = new Date();
    testInfoRef.current = { testId, startTime };
    dispatch({ type: 'START_TEST' });
    dispatchData({ type: 'RESET_DATA', payload: { testId, startTime, nBackLevel: nBack, totalTrials } });
    setTimeout(() => {
      showPosition(0);
    }, 1000);
  }, [generateSequence, nBack, totalTrials, showPosition]);
  
  const togglePause = useCallback(() => {
    if (!isPaused) {
      if (!trialStartTimeRef.current) return;
      const elapsed = performance.now() - trialStartTimeRef.current;
      const remaining = secondsPerTrial * 1000 - elapsed;
      remainingTimeRef.current = remaining > 0 ? remaining : 0;
      dispatch({ type: 'PAUSE_TEST' });
      clearTimeout(timerRef.current);
    } else {
      dispatch({ type: 'RESUME_TEST' });
      const delay = (remainingTimeRef.current != null && remainingTimeRef.current > 0)
                      ? remainingTimeRef.current
                      : secondsPerTrial * 1000;
      setTimeout(() => {
        showPosition(currentTrial, delay);
      }, 0);
    }
  }, [isPaused, currentTrial, secondsPerTrial, showPosition]);
  
  const stopTest = useCallback(() => {
    endTest();
  }, [endTest]);
  
  const resetTest = useCallback(() => {
    clearTimeout(timerRef.current);
    dispatch({ type: 'RESET_TEST' });
    dispatchData({ type: 'RESET_DATA', payload: {} });
  }, []);
  
  const exportAsCSV = useCallback(() => {
    const testToExport = { ...results, log: detailedLog, responses };
    let csv = "N-Back Test Results\n";
    csv += `Test Date,${formatDate(testInfoRef.current.startTime)}\n`;
    csv += `N-Back Level,${testInfoRef.current.nBackLevel || nBack}\n`;
    csv += `Total Trials,${totalTrials}\n`;
    csv += `Accuracy,${testToExport.accuracy}%\n`;
    csv += `Hits,${testToExport.hits}\n`;
    csv += `Misses,${testToExport.misses}\n`;
    csv += `False Alarms,${testToExport.falseAlarms}\n`;
    csv += `Correct Rejections,${testToExport.correctRejects}\n`;
    csv += `Average Reaction Time,${testToExport.averageRT}ms\n\n`;
    csv += "Detailed Log\n";
    csv += "Trial,Time,Event,Position,Is Match,Correct,Reaction Time\n";
    testToExport.log.forEach(entry => {
      const rtString = entry.reactionTime ? entry.reactionTime : "";
      csv += `${entry.trial},${entry.time},${entry.event},${entry.position},${entry.isMatch},${entry.correct !== undefined ? entry.correct : ""},${rtString}\n`;
    });
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `nback_test_${testInfoRef.current.testId}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, [results, nBack, detailedLog, responses, formatDate, totalTrials]);
  
  const exportAsText = useCallback(() => {
    const testToExport = { ...results, log: detailedLog, responses };
    let text = "N-Back Test Results\n";
    text += "===================\n\n";
    text += `Test Date: ${formatDate(testInfoRef.current.startTime)}\n`;
    text += `N-Back Level: ${testInfoRef.current.nBackLevel || nBack}\n`;
    text += `Total Trials: ${totalTrials}\n`;
    text += `Accuracy: ${testToExport.accuracy}%\n`;
    text += `Hits: ${testToExport.hits}\n`;
    text += `Misses: ${testToExport.misses}\n`;
    text += `False Alarms: ${testToExport.falseAlarms}\n`;
    text += `Correct Rejections: ${testToExport.correctRejects}\n`;
    text += `Average Reaction Time: ${testToExport.averageRT}ms\n\n`;
    text += "Detailed Log\n";
    text += "===========\n\n";
    text += "Trial | Time | Event | Position | Is Match | Correct | Reaction Time\n";
    text += "----------------------------------------------------------------------\n";
    testToExport.log.forEach(entry => {
      const rtString = entry.reactionTime ? `${entry.reactionTime}ms` : "-";
      const correctString = entry.correct !== undefined ? (entry.correct ? "Yes" : "No") : "-";
      text += `${entry.trial.toString().padEnd(5)} | ${entry.time.padEnd(12)} | ${entry.event.padEnd(15)} | ${entry.position.toString().padEnd(8)} | ${entry.isMatch ? "Yes".padEnd(7) : "No".padEnd(7)} | ${correctString.padEnd(7)} | ${rtString}\n`;
    });
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `nback_test_${testInfoRef.current.testId}.txt`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, [results, nBack, detailedLog, responses, formatDate, totalTrials]);
  
  const viewResults = useCallback(() => {
    if (isRunning && !isPaused) {
      const elapsed = performance.now() - trialStartTimeRef.current;
      remainingTimeRef.current = secondsPerTrial * 1000 - elapsed;
      dispatch({ type: 'PAUSE_TEST' });
      clearTimeout(timerRef.current);
    }
    dispatch({ type: 'VIEW_RESULTS' });
  }, [isRunning, isPaused, secondsPerTrial]);
  
  useEffect(() => {
    return () => {
      clearTimeout(timerRef.current);
      clearTimeout(errorTimerRef.current);
    };
  }, []);
  
  return {
    testState,
    testData,
    formatTime,
    formatDate,
    startTest,
    stopTest,
    togglePause,
    handleResponse,
    resetTest,
    viewResults,
    exportAsCSV,
    exportAsText,
    setError
  };
}

// Main App Component
function App() {
  const [config, setConfig] = useState({
    nBack: 2,
    secondsPerTrial: 3,
    matchPercentage: 30,
    totalTrials: 30,
    showFeedback: false,
    hideTrialNumber: false
  });

  const [uiState, setUiState] = useState({
    fullScreen: false,
    showSettings: false
  });
  
  const nBackTest = useNBackTest(config);
  const { 
    testState, formatDate,
    startTest, stopTest, togglePause, handleResponse, resetTest,
    viewResults, exportAsCSV, exportAsText
  } = nBackTest;
  
  const { isRunning, isPaused, currentTrial, viewingResults } = testState;
  
  const gridSize = 3;
  const gridItems = useMemo(() => Array.from({ length: gridSize * gridSize }, (_, i) => i), []);
  
  const toggleFullScreen = useCallback(() => {
    setUiState(prev => ({ ...prev, fullScreen: !prev.fullScreen }));
  }, []);
  
  const toggleSettings = useCallback(() => {
    setUiState(prev => ({ ...prev, showSettings: !prev.showSettings }));
  }, []);
  
  const updateConfig = useCallback((key, value) => {
    setConfig(prev => ({ ...prev, [key]: value }));
  }, []);

  return (
    <div className="container">
      {!viewingResults && (
        <div className={`test-view ${uiState.fullScreen ? 'full-screen' : ''}`}>
          <div className="header">
            <h1>N-Back Position Test</h1>
            <div className="header-buttons">
              <button onClick={toggleSettings} className="btn btn-secondary">
                {uiState.showSettings ? 'Hide Settings' : 'Show Settings'}
              </button>
              <button onClick={toggleFullScreen} className="btn btn-secondary">
                {uiState.fullScreen ? 'Exit Full Screen' : 'Full Screen'}
              </button>
            </div>
          </div>
          
          {!config.hideTrialNumber && isRunning && (
            <div className="trial-counter">
              Trial: {currentTrial + 1} / {config.totalTrials}
            </div>
          )}
          
          <div className={`grid ${uiState.fullScreen ? 'grid-large' : ''}`}>
            {gridItems.map((index) => (
              <div key={index} className={`grid-cell ${testState.currentPosition === index ? 'active' : ''}`}>
                {/* Optional content for debugging: {index} */}
              </div>
            ))}
          </div>
          
          {testState.errorMessage && (
            <div className="error-message">
              {testState.errorMessage}
            </div>
          )}
          
          {isRunning && (
            <div className="controls">
              <button 
                onClick={() => {
                  handleResponse();
                  const btn = document.querySelector('.btn-match');
                  btn.classList.add('btn-match-clicked');
                  setTimeout(() => { btn.classList.remove('btn-match-clicked'); }, 200);
                }}
                className="btn btn-match"
              >
                MATCH
              </button>
              <p className="instruction-text">
                Press when the current position matches the position from {config.nBack} trials ago
              </p>
              <div className="action-buttons">
                <button onClick={togglePause} className={`btn ${isPaused ? 'btn-resume' : 'btn-pause'}`}>
                  {isPaused ? 'Resume' : 'Pause'}
                </button>
                <button onClick={stopTest} className="btn btn-stop">
                  Stop
                </button>
              </div>
            </div>
          )}
          
          {!isRunning && !testState.isComplete && (
            <div className="start-container">
              <button onClick={startTest} className="btn btn-start">
                Start Test
              </button>
            </div>
          )}
          
          {testState.isComplete && (
            <div className="complete-container">
              <button onClick={viewResults} className="btn btn-primary">
                View Results
              </button>
              <button onClick={resetTest} className="btn btn-secondary">
                New Test
              </button>
            </div>
          )}
          
          {!isRunning && !testState.isComplete && (
            <div className="instructions">
              <h3>How to play:</h3>
              <ol>
                <li>You will see positions highlighted one at a time in the grid above.</li>
                <li>Press the MATCH button <strong>only</strong> when the current position matches the position from {config.nBack} trials ago.</li>
                <li>Don't press anything for non-matches.</li>
                <li>The test measures your working memory capacity.</li>
              </ol>
            </div>
          )}
        </div>
      )}
      
      {viewingResults && (
        <div className="results-view">
          <div className="results-header">
            <h1>N-Back Test Results</h1>
          </div>
          
          <div className="results-content">
            <div className="results-summary-container">
              <div className="results-panel">
                <h3>Summary</h3>
                <p className="accuracy">Accuracy: {nBackTest.testData.results.accuracy}%</p>
                <p>Hits (correct matches): {nBackTest.testData.results.hits}</p>
                <p>Misses (missed matches): {nBackTest.testData.results.misses}</p>
                <p>False Alarms (incorrect responses): {nBackTest.testData.results.falseAlarms}</p>
                <p>Correct Rejections (correct non-responses): {nBackTest.testData.results.correctRejects}</p>
                <p>Average Reaction Time: {nBackTest.testData.results.averageRT}ms</p>
                <p>N-Back Level: {config.nBack}</p>
                <p>Completed Trials: {nBackTest.testData.results.completedTrials || currentTrial + 1} of {config.totalTrials}</p>
                <p>Test Date: {nBackTest.testData.results.startTime ? formatDate(nBackTest.testData.results.startTime) : 'N/A'}</p>
                
              </div>
              
              <div className="results-panel">
                <h3>Button Presses</h3>
                <p>Total Button Presses: {nBackTest.testData.responses.filter(r => r.isResponse === true).length}</p>
                <p>Correct Presses: {nBackTest.testData.results.hits}</p>
                <p>Incorrect Presses: {nBackTest.testData.results.falseAlarms}</p>
                <p>Miss Rate: {Math.round((nBackTest.testData.results.misses / (nBackTest.testData.results.hits + nBackTest.testData.results.misses || 1)) * 100)}%</p>
                <p>False Alarm Rate: {Math.round((nBackTest.testData.results.falseAlarms / (nBackTest.testData.results.falseAlarms + nBackTest.testData.results.correctRejects || 1)) * 100)}%</p>
              </div>
            </div>
            
            <div className="export-options">
              <h3>Export Options</h3>
              <div className="export-buttons">
                <button onClick={exportAsCSV} className="btn btn-primary">Export as CSV</button>
                <button onClick={exportAsText} className="btn btn-primary">Export as Text</button>
              </div>
            </div>
            
            <div className="detailed-log">
              <h3>Detailed Log</h3>
              <div className="table-container">
                <table>
                  <thead>
                    <tr>
                      <th>Trial</th>
                      <th>Time</th>
                      <th>Event</th>
                      <th>Position</th>
                      <th>Is Match</th>
                      <th>Result</th>
                      <th>Reaction Time</th>
                    </tr>
                  </thead>
                  <tbody>
                    {nBackTest.testData.detailedLog
                      .filter(entry => entry.event === "HIT" || entry.event === "MISS" || entry.event === "FALSE_ALARM" || entry.event === "CORRECT_REJECT")
                      .map((entry, index) => (
                      <tr key={index} className={entry.correct ? "correct-row" : "incorrect-row"}>
                        <td>{entry.trial}</td>
                        <td>{entry.time}</td>
                        <td>{entry.event}</td>
                        <td>{entry.position}</td>
                        <td>{entry.isMatch ? "Yes" : "No"}</td>
                        <td>{entry.correct ? "Correct" : "Incorrect"}</td>
                        <td>{entry.reactionTime ? `${entry.reactionTime}ms` : "-"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            
            <div className="complete-container">
              <button onClick={resetTest} className="btn btn-secondary">
                New Test
              </button>
            </div>
          </div>
        </div>
      )}
      
      {uiState.showSettings && (
        <div className="settings-overlay">
          <div className="settings-panel">
            <div className="settings-header">
              <h2>Test Settings</h2>
              <button onClick={toggleSettings} className="close-button" style={{ position: 'relative', zIndex: 1001 }}>✕</button>
            </div>
            
            {isRunning && (
              <div className="settings-disabled-overlay">
                <div className="settings-disabled-message">
                  <h3>Settings Locked</h3>
                  <p>Settings cannot be modified while the test is running.</p>
                  <p>Stop or reset the test to change settings.</p>
                </div>
              </div>
            )}
            
            <div className="settings-form">
              <div className="form-group">
                <label>N-Back Level</label>
                <input type="number" min="1" max="10"
                  value={config.nBack} 
                  onChange={(e) => updateConfig('nBack', parseInt(e.target.value))} 
                  disabled={isRunning} />
              </div>
              
              <div className="form-group">
                <label>Seconds Per Trial</label>
                <input type="number" min="0.5" max="10" step="0.5"
                  value={config.secondsPerTrial} 
                  onChange={(e) => updateConfig('secondsPerTrial', parseFloat(e.target.value))} 
                  disabled={isRunning} />
              </div>
              
              <div className="form-group">
                <label>Match Percentage (%)</label>
                <input type="number" min="0" max="100"
                  value={config.matchPercentage} 
                  onChange={(e) => updateConfig('matchPercentage', parseInt(e.target.value))} 
                  disabled={isRunning} />
              </div>
              
              <div className="form-group">
                <label>Total Trials</label>
                <input type="number" min={config.nBack + 1} max="100"
                  value={config.totalTrials} 
                  onChange={(e) => updateConfig('totalTrials', parseInt(e.target.value))} 
                  disabled={isRunning} />
              </div>
              
              <div className="form-group checkbox">
                <label>
                  <input type="checkbox" 
                    checked={config.showFeedback} 
                    onChange={(e) => updateConfig('showFeedback', e.target.checked)} 
                    disabled={isRunning} />
                  Show Error Feedback
                </label>
              </div>
              
              <div className="form-group checkbox">
                <label>
                  <input type="checkbox" 
                    checked={config.hideTrialNumber} 
                    onChange={(e) => updateConfig('hideTrialNumber', e.target.checked)} 
                    disabled={isRunning} />
                  Hide Trial Number
                </label>
              </div>
              
              {!isRunning && (
                <button onClick={toggleSettings} className="btn btn-save">Save Settings</button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
