let mediaRec = null;
let mediaPlayer = null;
let isRecording = false;
let isPlaying = false;
let currentRecording = null;  // To track which recording is currently being played
let currentPosition = 0;  // Store current playback position when paused
let currentSpeed = 1;  // Store the current speed for playback

// Wait for Cordova to be ready
document.addEventListener('deviceready', function () {
    // Request permissions for recording
    cordova.plugins.permissions.requestPermissions(
        [
            cordova.plugins.permissions.RECORD_AUDIO,
            cordova.plugins.permissions.WRITE_EXTERNAL_STORAGE
        ],
        function (status) {
            if (status.hasPermission) {
                console.log("Permissions granted");
            } else {
                alert("Permissions denied. The app cannot function without permissions.");
            }
        },
        function (error) {
            console.error("Permission request failed", error);
        }
    );
});

// Start recording when "Start Recording" is clicked
document.getElementById("recordButton").addEventListener("click", function () {
    if (!isRecording) {
        startRecording();
    }
});

// Stop recording when "Stop Recording" is clicked
document.getElementById("stopButton").addEventListener("click", function () {
    if (isRecording) {
        stopRecording();
    }
});

function startRecording() {
    isRecording = true;
    document.getElementById("recordButton").disabled = true;
    document.getElementById("stopButton").disabled = false;

    // File path for the recording
    const fileName = "recording_" + Date.now() + ".wav";
    const filePath = cordova.file.externalDataDirectory + fileName;

    // Initialize Media object
    mediaRec = new Media(filePath,
        function () {
            console.log("Recording succeeded");
        },
        function (err) {
            console.error("Recording error: ", err);
        }
    );

    // Start recording
    mediaRec.startRecord();
    console.log("Recording started: " + filePath);
}

function stopRecording() {
    isRecording = false;
    document.getElementById("recordButton").disabled = false;
    document.getElementById("stopButton").disabled = true;

    if (mediaRec) {
        // Stop recording
        mediaRec.stopRecord();

        // Get the recorded file path
        const filePath = mediaRec.src;

        // Release Media object
        mediaRec.release();
        mediaRec = null;

        console.log("Recording stopped: " + filePath);

        // Save and display recording
        displayRecording(filePath);
    } else {
        console.error("No active recording to stop");
    }
}

function displayRecording(filePath) {
    const recordingsList = document.getElementById("recordingsList");
    const li = document.createElement("li");
    const playButton = document.createElement("button");
    const deleteButton = document.createElement("button");

    playButton.textContent = "Play";
    playButton.style.marginLeft = "10px";
    deleteButton.textContent = "Delete";
    deleteButton.style.marginLeft = "10px";

    // Play button click listener
    playButton.addEventListener("click", function () {
        if (currentRecording === filePath) {
            // If already playing and the same recording is clicked, toggle between play and pause
            if (isPlaying) {
                mediaPlayer.pause();
                isPlaying = false;
                playButton.textContent = "Play";
            } else {
                mediaPlayer.play();
                isPlaying = true;
                playButton.textContent = "Pause";
            }
        } else {
            // If it's a new recording, stop the old one and start playing the new one
            if (mediaPlayer) {
                mediaPlayer.stop();
                mediaPlayer.release();
            }

            mediaPlayer = new Media(filePath,
                function () {
                    console.log("Playback finished");
                    isPlaying = false;
                    playButton.textContent = "Play";
                    resetSeekbar(filePath);  // Reset the seekbar when playback finishes

                    // Reset the position to the beginning when finished
                    mediaPlayer.seekTo(0); // Start from the beginning
                },
                function (err) {
                    console.error("Playback error: ", err);
                }
            );

            // Reset position to the beginning every time it starts
            mediaPlayer.seekTo(0); // Start from the beginning
            mediaPlayer.setRate(currentSpeed); // Apply the stored playback speed
            mediaPlayer.play();
            isPlaying = true;
            playButton.textContent = "Pause";

            // Set the current recording to the one being played
            currentRecording = filePath;

            // Check if the seekbar already exists; create it only once
            let seekbar = document.getElementById("seekbar_" + filePath);
            if (!seekbar) {
                seekbar = document.createElement("input");
                seekbar.type = "range";
                seekbar.min = 0;
                seekbar.max = 100;
                seekbar.value = 0;
                seekbar.id = "seekbar_" + filePath;  // Unique ID for each seekbar

                // Seekbar event listener to adjust playback position
                seekbar.addEventListener("input", function () {
                    const seekPosition = (seekbar.value / 100); // Get the percentage
                    const duration = mediaPlayer.getDuration();
                    const newPosition = seekPosition * duration * 1000; // Convert to milliseconds
                    mediaPlayer.seekTo(newPosition);
                });

                li.appendChild(seekbar);
            }

            // Update seekbar during playback, but only for the current recording
            const interval = setInterval(function () {
                if (currentRecording === filePath) {
                    mediaPlayer.getCurrentPosition(function (position) {
                        const seek = document.getElementById("seekbar_" + filePath);
                        if (seek) {
                            seek.value = (position / mediaPlayer.getDuration()) * 100;
                        }
                    });
                }
            }, 1000);

            // Clean up when finished
            mediaPlayer.onStatusUpdate = function (status) {
                if (status === Media.MEDIA_STOPPED) {
                    clearInterval(interval);
                    resetSeekbar(filePath);  // Reset the seekbar when playback is stopped
                    currentPosition = 0;  // Reset stored position
                    // Start from the beginning of the audio
                    mediaPlayer.seekTo(0);
                    playButton.textContent = "Play";  // Ensure the button shows "Play" after stop
                }
            };
        }
    });

    // Delete button click listener
    deleteButton.addEventListener("click", function () {
        li.remove(); // Remove the recording from the list
        if (currentRecording === filePath) {
            // Stop and release the media player if the current recording is deleted
            if (mediaPlayer) {
                mediaPlayer.stop();
                mediaPlayer.release();
            }
            currentRecording = null;
            isPlaying = false;
        }
    });

    li.textContent = "Saved: " + filePath;
    li.appendChild(playButton);
    li.appendChild(deleteButton);

    // Add speed control buttons
    const speedControlDiv = document.createElement("div");
    speedControlDiv.id = "speedControl_" + filePath;

    const speeds = [0.5, 1, 1.5, 2];
    speeds.forEach(speed => {
        const speedButton = document.createElement("button");
        speedButton.textContent = `${speed}x`;
        speedButton.addEventListener("click", function () {
            currentSpeed = speed; // Store selected speed
            if (mediaPlayer && isPlaying) {
                mediaPlayer.setRate(speed); // Apply new speed if already playing
            }
        });
        speedControlDiv.appendChild(speedButton);
    });

    li.appendChild(speedControlDiv);
    recordingsList.appendChild(li);
}

// Function to reset the seekbar
function resetSeekbar(filePath) {
    const seekbar = document.getElementById("seekbar_" + filePath);
    if (seekbar) {
        seekbar.value = 0;  // Reset seekbar position
    }
}



// Update the current position when paused
function updateCurrentPosition() {
    if (mediaPlayer) {
        mediaPlayer.getCurrentPosition(function (position) {
            currentPosition = position * 1000; // Store the position in milliseconds
        });
    }
}
