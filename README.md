# N-Back Position Test

A comprehensive, configurable web application for administering the N-Back cognitive task to measure working memory performance.

<img width="500" alt="Screenshot 2025-03-11 at 1 13 23 PM" src="https://github.com/user-attachments/assets/fc7b8da9-de70-4c4f-9ea4-9cc71f4ea89b" />

## Overview

The N-Back Position Test is a scientifically validated cognitive assessment tool that measures working memory capacity. In this task, participants are shown a sequence of positions in a 3×3 grid and must identify when the current position matches the position from N trials ago.

To use this app online, click here: https://n-back-nine.vercel.app/

### Features

- **Configurable N-Back Level**: Test working memory with different difficulty levels (1-back through 10-back)
- **Detailed Performance Metrics**: Comprehensive data collection including hits, misses, false alarms, correct rejections, and reaction times
- **Customizable Test Parameters**: Adjust trial duration, match percentage, and total trials
- **Results Analysis**: View detailed performance analysis with accuracy metrics and trial-by-trial breakdown
- **Data Export**: Export results in CSV or text format for further analysis
- **Responsive Design**: Works on desktop and tablet devices

## Getting Started

### Prerequisites

- Node.js (v14.0.0 or later)
- npm (v6.0.0 or later)

### Installation

1. Clone the repository:
   ```
   git clone https://github.com/jerhsiao/nback-position-test.git
   cd nback-position-test
   ```

2. Install dependencies:
   ```
   npm install
   ```

3. Start the development server:
   ```
   npm start
   ```

4. Open [http://localhost:3000](http://localhost:3000) to view it in your browser.

## Usage Guide

### Running a Test Session

1. Configure test parameters (optional) by clicking "Show Settings"
2. Click "Start Test" to begin
3. Press the "MATCH" button when the current position matches the position from N trials ago
4. View your results after test completion

### Configuration Options

- **N-Back Level**: Determines how many positions back you need to remember (default: 2)
- **Seconds Per Trial**: How long each position is displayed (default: 3 seconds)
- **Match Percentage**: Percentage of trials that should be matches (default: 30%)
- **Total Trials**: Number of positions to be shown (default: 30)
- **Show Error Feedback**: Toggle feedback messages for incorrect responses
- **Hide Trial Number**: Option to hide the current trial counter

### Interpreting Results

- **Hits**: Correct identification of matches
- **Misses**: Failure to identify matches
- **False Alarms**: Incorrect responses to non-matches
- **Correct Rejections**: Correctly not responding to non-matches
- **Accuracy**: Overall percentage of correct responses
- **Average Reaction Time**: Average time to respond to matches

#### Results in Browser
<img width="300" alt="Screenshot 2025-03-11 at 2 24 20 PM" src="https://github.com/user-attachments/assets/96f3c010-18c6-4859-968b-ef4c126b7e04" />

#### Text Results
<img width="300" alt="Screenshot 2025-03-11 at 2 24 41 PM" src="https://github.com/user-attachments/assets/5a92cd5d-7bfa-482a-8e67-9c0760f7dcff" />

#### CSV Results
<img width="300" alt="Screenshot 2025-03-11 at 2 25 10 PM" src="https://github.com/user-attachments/assets/f405e109-7ba5-4dcf-a651-39e7ac96de4f" />


## Research Applications

This application is suitable for:

- Cognitive psychology research
- Working memory assessment
- Longitudinal cognitive monitoring
- Educational research
- Neuroscience studies

For research use, consider implementing additional components for IRB approval, such as:
- Participant consent mechanism
- Secure data storage
- Participant identification protocol

## Available Scripts

In the project directory, you can run:

### `npm start`

Runs the app in the development mode. Open [http://localhost:3000](http://localhost:3000) to view it in your browser.

The page will reload when you make changes. You may also see any lint errors in the console.

### `npm test`

Launches the test runner in the interactive watch mode. See the section about [running tests](https://facebook.github.io/create-react-app/docs/running-tests) for more information.

### `npm run build`

Builds the app for production to the `build` folder. It correctly bundles React in production mode and optimizes the build for the best performance.

The build is minified and the filenames include the hashes. Your app is ready to be deployed!

See the section about [deployment](https://facebook.github.io/create-react-app/docs/deployment) for more information.

### `npm run eject`

**Note: this is a one-way operation. Once you `eject`, you can't go back!**

If you aren't satisfied with the build tool and configuration choices, you can `eject` at any time. This command will remove the single build dependency from your project.

Instead, it will copy all the configuration files and the transitive dependencies (webpack, Babel, ESLint, etc) right into your project so you have full control over them. All of the commands except `eject` will still work, but they will point to the copied scripts so you can tweak them. At this point you're on your own.

You don't have to ever use `eject`. The curated feature set is suitable for small and middle deployments, and you shouldn't feel obligated to use this feature.

## Technical Implementation

The application is built with:

- React.js for UI components
- React Hooks for state management
- Reducer pattern for complex state logic

Key components include:

- Custom `useNBackTest` hook encapsulating core test logic
- Test configuration system with adaptive difficulty
- Comprehensive data collection and analysis
- Export functionality for research use

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the project
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgments

- Based on the N-Back paradigm introduced by Wayne Kirchner (1958)
- Inspired by cognitive assessment tools used in memory research

## Learn More

- [Scientific background on the N-Back task](https://en.wikipedia.org/wiki/N-back)
- [Create React App documentation](https://facebook.github.io/create-react-app/docs/getting-started)
- [React documentation](https://reactjs.org/)
