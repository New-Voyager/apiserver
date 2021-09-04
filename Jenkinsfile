pipeline {
    agent any
    options {
        // No concurrent builds within branch.
        disableConcurrentBuilds()
        // The build time currently includes the time waiting for an available executor,
        // so we need to give it some extra time here.
        timeout(time: 120, unit: 'MINUTES')
    }
    stages {
        stage('Setup') {
            steps {
                setBuildStatus("Build is in progress", "PENDING");
                sh 'printenv | sort'
                sh 'pwd'
                sh 'ls -l'
            }
        }
        stage('Lint') {
            steps {
                sh 'make lint'
            }
        }
        stage('Build') {
            steps {
                sh 'make build'
            }
        }
        stage('Build Test Image') {
            steps {
                sh 'make docker-build-test'
            }
        }
        stage('Unit Test') {
            steps {
                sh 'make docker-unit-tests'
            }
        }
        stage('API Test') {
            steps {
                sh 'make docker-tests'
            }
        }
        stage('Publish') {
            when {
                expression { return env.GIT_BRANCH == 'master' }
            }
            steps {
                sh 'make docker-build' 
                sh 'make publish'
            }
        }
    }
    post {
        always {
            cleanUpDockerResources()
            cleanUpBuild()
        }
        success {
            setBuildStatus("Build succeeded", "SUCCESS");
        }
        aborted {
            setBuildStatus("Build aborted", "FAILURE");
        }
        failure {
            setBuildStatus("Build failed", "FAILURE");
        }
    }
}

/*
Notify GitHub the build result.
https://plugins.jenkins.io/github/
*/
def setBuildStatus(String message, String state) {
    step([
        $class: "GitHubCommitStatusSetter",
        reposSource: [$class: "ManuallyEnteredRepositorySource", url: env.GIT_URL],
        contextSource: [$class: "ManuallyEnteredCommitContextSource", context: "ci/jenkins"],
        errorHandlers: [[$class: "ChangingBuildStatusErrorHandler", result: "UNSTABLE"]],
        statusResultSource: [ $class: "ConditionalStatusResultSource", results: [[$class: "AnyBuildResult", message: message, state: state]] ]
    ]);
}

def cleanUpBuild() {

}

/*
Clean up docker images and other docker resources.
*/
def cleanUpDockerResources() {
    // Remove old stopped containers.
    sh 'docker container prune --force --filter until=12h || true'
    // Remove dangling images.
    sh 'docker image prune --force || true'
    // Remove old unused networks. Being a little aggressive here due to limited IP address pool.
    sh 'docker network prune --force --filter until=120m || true'
    // Remove unused volumes.
    sh 'docker volume prune --force || true'
}
