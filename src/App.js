import React, { useState, useReducer, useEffect, useRef, useCallback, useMemo } from 'react';
import './App.css';

// Reducer for complex state logic
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
        errorMessage: "",
        selectedTestId: null
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
    case 'VIEW_SAVED_TEST':
      return {
        ...state,
        selectedTestId: action.payload
      };
    case 'BACK_TO_TEST':
      return {
        ...state,
        viewingResults: false,
        selectedTestId: null
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
        errorMessage: "",
        selectedTestId: null
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
    selectedTestId: null,
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
  
  const [savedTests, setSavedTests] = useState([]);
  
  // Refs for data that doesn't trigger re-renders
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
  
  // Ref to store remaining time when pausing a trial
  const remainingTimeRef = useRef(null);
  
  const { isRunning, isPaused, currentTrial, selectedTestId } = testState;
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
  
  // Safety guard: Only proceed if the test is running.
  const showPosition = useCallback((trialIndex, delay = secondsPerTrial * 1000) => {
    if (!isRunning) return;
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
        showPosition(trialIndex + 1);
      }, 500);
    }, delay);
  }, [secondsPerTrial, nBack, showFeedback, isPositionMatch, logEvent, addResponse, updateResults, endTest, setError, isRunning]);
  
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
  
  // Safety guard: Ensure trialStartTimeRef.current is defined before computing elapsed time.
  const togglePause = useCallback(() => {
    if (!isPaused) {
      if (!trialStartTimeRef.current) return; // Safety guard in case pause is triggered unexpectedly.
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
  
  const saveTestResults = useCallback(() => {
    const testDataToSave = { ...results, log: detailedLog, responses };
    setSavedTests(prev => [...prev, testDataToSave]);
    setError("Test results saved successfully!");
  }, [results, detailedLog, responses, setError]);
  
  const deleteTest = useCallback((testId) => {
    if (window.confirm("Are you sure you want to delete this test?")) {
      setSavedTests(prev => prev.filter(test => test.testId !== testId));
      if (selectedTestId === testId) {
        dispatch({ type: 'VIEW_SAVED_TEST', payload: null });
      }
    }
  }, [selectedTestId]);
  
  const exportAsCSV = useCallback(() => {
    const testToExport = selectedTestId ? savedTests.find(test => test.testId === selectedTestId)
      : { ...results, log: detailedLog, responses };
    if (!testToExport) return;
    let csv = "N-Back Test Results\n";
    csv += `Test Date,${formatDate(testToExport.startTime)}\n`;
    csv += `N-Back Level,${testToExport.nBackLevel}\n`;
    csv += `Total Trials,${testToExport.totalTrials}\n`;
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
    link.setAttribute('download', `nback_test_${testToExport.testId}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, [selectedTestId, savedTests, results, detailedLog, responses, formatDate]);
  
  const exportAsText = useCallback(() => {
    const testToExport = selectedTestId ? savedTests.find(test => test.testId === selectedTestId)
      : { ...results, log: detailedLog, responses };
    if (!testToExport) return;
    let text = "N-Back Test Results\n";
    text += "===================\n\n";
    text += `Test Date: ${formatDate(testToExport.startTime)}\n`;
    text += `N-Back Level: ${testToExport.nBackLevel}\n`;
    text += `Total Trials: ${testToExport.totalTrials}\n`;
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
    link.setAttribute('download', `nback_test_${testToExport.testId}.txt`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, [selectedTestId, savedTests, results, detailedLog, responses, formatDate]);
  
  const viewResults = useCallback(() => {
    if (isRunning && !isPaused) {
      const elapsed = performance.now() - trialStartTimeRef.current;
      remainingTimeRef.current = secondsPerTrial * 1000 - elapsed;
      dispatch({ type: 'PAUSE_TEST' });
      clearTimeout(timerRef.current);
    }
    dispatch({ type: 'VIEW_RESULTS' });
  }, [isRunning, isPaused, secondsPerTrial]);
  
  const viewSavedTest = useCallback((testId) => {
    dispatch({ type: 'VIEW_SAVED_TEST', payload: testId });
  }, []);
  
  const backToTest = useCallback(() => {
    dispatch({ type: 'BACK_TO_TEST' });
  }, []);
  
  useEffect(() => {
    return () => {
      clearTimeout(timerRef.current);
      clearTimeout(errorTimerRef.current);
    };
  }, []);
  
  return {
    testState,
    testData,
    savedTests,
    positionsRef,
    formatTime,
    formatDate,
    startTest,
    stopTest,
    togglePause,
    handleResponse,
    resetTest,
    viewResults,
    viewSavedTest,
    backToTest,
    saveTestResults,
    deleteTest,
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
    thresholdAdvance: 80,
    thresholdFallback: 50,
    thresholdFallbackCount: 3,
    showFeedback: true,
    hideTrialNumber: false
  });

  const [uiState, setUiState] = useState({
    fullScreen: false,
    showSettings: false
  });
  
  const nBackTest = useNBackTest(config);
  const { 
    testState, testData, savedTests, formatDate,
    startTest, stopTest, togglePause, handleResponse, resetTest,
    viewResults, viewSavedTest, backToTest,
    saveTestResults, deleteTest, exportAsCSV, exportAsText
  } = nBackTest;
  
  const { isRunning, isPaused, currentTrial, selectedTestId } = testState;
  const { responses, detailedLog, results } = testData;
  const { fullScreen, showSettings } = uiState;
  
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
      {!nBackTest.testState.viewingResults && (
        <div className={`test-view ${fullScreen ? 'full-screen' : ''}`}>
          <div className="header">
            <h1>N-Back Position Test</h1>
            <div className="header-buttons">
              <button onClick={toggleSettings} className="btn btn-secondary">
                {showSettings ? 'Hide Settings' : 'Show Settings'}
              </button>
              <button onClick={toggleFullScreen} className="btn btn-secondary">
                {fullScreen ? 'Exit Full Screen' : 'Full Screen'}
              </button>
            </div>
          </div>
          
          {!config.hideTrialNumber && isRunning && (
            <div className="trial-counter">
              Trial: {currentTrial + 1} / {config.totalTrials}
            </div>
          )}
          
          <div className={`grid ${fullScreen ? 'grid-large' : ''}`}>
            {gridItems.map((index) => (
              <div key={index} className={`grid-cell ${nBackTest.testState.currentPosition === index ? 'active' : ''}`}>
                {/* Visual indicator */}
              </div>
            ))}
          </div>
          
          {nBackTest.testState.errorMessage && (
            <div className="error-message">
              {nBackTest.testState.errorMessage}
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
          
          {!isRunning && !nBackTest.testState.isComplete && (
            <div className="start-container">
              <button onClick={startTest} className="btn btn-start">
                Start Test
              </button>
            </div>
          )}
          
          {nBackTest.testState.isComplete && (
            <div className="complete-container">
              <button onClick={viewResults} className="btn btn-primary">
                View Results
              </button>
              <button onClick={resetTest} className="btn btn-secondary">
                New Test
              </button>
            </div>
          )}
          
          {!isRunning && !nBackTest.testState.isComplete && (
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
      
      {nBackTest.testState.viewingResults && (
        <div className="results-view">
          <div className="results-header">
            <h1>N-Back Test Results</h1>
            <div>
              <button onClick={backToTest} className="btn btn-secondary">
                Back to Test
              </button>
            </div>
          </div>
          
          <div className="tabs">
            <button className={`tab ${!selectedTestId ? 'active' : ''}`} onClick={() => viewSavedTest(null)}>
              Current Test
            </button>
            <button className={`tab ${selectedTestId ? 'active' : ''}`} onClick={() => {
                if (savedTests.length > 0 && !selectedTestId) {
                  viewSavedTest(savedTests[0].testId);
                }
              }}>
              Saved Tests ({savedTests.length})
            </button>
          </div>
          
          {!selectedTestId && (
            <div className="results-content">
              <div className="results-summary-container">
                <div className="results-panel">
                  <h3>Summary</h3>
                  <p className="accuracy">Accuracy: {results.accuracy}%</p>
                  <p>Hits (correct matches): {results.hits}</p>
                  <p>Misses (missed matches): {results.misses}</p>
                  <p>False Alarms (incorrect responses): {results.falseAlarms}</p>
                  <p>Correct Rejections (correct non-responses): {results.correctRejects}</p>
                  <p>Average Reaction Time: {results.averageRT}ms</p>
                  <p>N-Back Level: {config.nBack}</p>
                  <p>Completed Trials: {results.completedTrials || currentTrial + 1} of {config.totalTrials}</p>
                  <p>Test Date: {results.startTime ? formatDate(results.startTime) : 'N/A'}</p>
                  
                  <div className="threshold-message">
                    {results.accuracy >= config.thresholdAdvance && (
                      <p className="success-message">
                        Congratulations! You can advance to {config.nBack + 1}-back.
                      </p>
                    )}
                    {results.accuracy < config.thresholdFallback && (
                      <p className="warning-message">
                        Consider trying {Math.max(1, config.nBack - 1)}-back.
                      </p>
                    )}
                  </div>
                </div>
                
                <div className="results-panel">
                  <h3>Button Presses</h3>
                  <p>Total Button Presses: {responses.filter(r => r.isResponse === true).length}</p>
                  <p>Correct Presses: {results.hits}</p>
                  <p>Incorrect Presses: {results.falseAlarms}</p>
                  <p>Miss Rate: {Math.round((results.misses / (results.hits + results.misses || 1)) * 100)}%</p>
                  <p>False Alarm Rate: {Math.round((results.falseAlarms / (results.falseAlarms + results.correctRejects || 1)) * 100)}%</p>
                </div>
              </div>
              
              <div className="export-options">
                <h3>Export Options</h3>
                <div className="export-buttons">
                  <button onClick={exportAsCSV} className="btn btn-primary">Export as CSV</button>
                  <button onClick={exportAsText} className="btn btn-primary">Export as Text</button>
                  <button onClick={saveTestResults} className="btn btn-success">Save Test Results</button>
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
                      {detailedLog
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
            </div>
          )}
          
          {selectedTestId && (
            <div className="results-content">
              {(() => {
                const selectedTest = savedTests.find(test => test.testId === selectedTestId);
                if (!selectedTest) return null;
                return (
                  <>
                    <div className="results-summary-container">
                      <div className="results-panel">
                        <h3>Summary</h3>
                        <p className="accuracy">Accuracy: {selectedTest.accuracy}%</p>
                        <p>Hits (correct matches): {selectedTest.hits}</p>
                        <p>Misses (missed matches): {selectedTest.misses}</p>
                        <p>False Alarms (incorrect responses): {selectedTest.falseAlarms}</p>
                        <p>Correct Rejections (correct non-responses): {selectedTest.correctRejects}</p>
                        <p>Average Reaction Time: {selectedTest.averageRT}ms</p>
                        <p>N-Back Level: {selectedTest.nBackLevel}</p>
                        <p>Completed Trials: {selectedTest.completedTrials || 'N/A'} of {selectedTest.totalTrials || 'N/A'}</p>
                        <p>Test Date: {formatDate(selectedTest.startTime)}</p>
                        
                        <div className="threshold-message">
                          {selectedTest.accuracy >= config.thresholdAdvance && (
                            <p className="success-message">
                              Performance sufficient to advance to {selectedTest.nBackLevel + 1}-back.
                            </p>
                          )}
                          {selectedTest.accuracy < config.thresholdFallback && (
                            <p className="warning-message">
                              Consider trying {Math.max(1, selectedTest.nBackLevel - 1)}-back.
                            </p>
                          )}
                        </div>
                      </div>
                      
                      <div className="results-panel">
                        <h3>Button Presses</h3>
                        <p>Total Button Presses: {selectedTest.responses?.filter(r => r.isResponse).length || 0}</p>
                        <p>Correct Presses: {selectedTest.hits}</p>
                        <p>Incorrect Presses: {selectedTest.falseAlarms}</p>
                        <p>Miss Rate: {Math.round((selectedTest.misses / (selectedTest.hits + selectedTest.misses || 1)) * 100)}%</p>
                        <p>False Alarm Rate: {Math.round((selectedTest.falseAlarms / (selectedTest.falseAlarms + selectedTest.correctRejects || 1)) * 100)}%</p>
                      </div>
                    </div>
                    
                    <div className="export-options">
                      <h3>Export Options</h3>
                      <div className="export-buttons">
                        <button onClick={exportAsCSV} className="btn btn-primary">Export as CSV</button>
                        <button onClick={exportAsText} className="btn btn-primary">Export as Text</button>
                        <button onClick={() => deleteTest(selectedTest.testId)} className="btn btn-danger">Delete Test</button>
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
                            {selectedTest.log
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
                  </>
                );
              })()}
            </div>
          )}
        </div>
      )}
      
      {showSettings && (
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
              
              <div className="form-group">
                <label>Threshold Advance (%)</label>
                <input type="number" min="1" max="100"
                  value={config.thresholdAdvance} 
                  onChange={(e) => updateConfig('thresholdAdvance', parseInt(e.target.value))} 
                  disabled={isRunning} />
              </div>
              
              <div className="form-group">
                <label>Threshold Fallback (%)</label>
                <input type="number" min="1" max="100"
                  value={config.thresholdFallback} 
                  onChange={(e) => updateConfig('thresholdFallback', parseInt(e.target.value))} 
                  disabled={isRunning} />
              </div>
              
              <div className="form-group">
                <label>Threshold Fallback Count</label>
                <input type="number" min="1" max="10"
                  value={config.thresholdFallbackCount} 
                  onChange={(e) => updateConfig('thresholdFallbackCount', parseInt(e.target.value))} 
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
