pipeline {
    agent any


    parameters{
        string(name: 'tag', defaultValue: 'main', description: 'Image Tag')
        booleanParam(name: 'buildAgent', defaultValue: false, description: 'Build B2B Agents')
        booleanParam(name: 'buildAgentWatcher', defaultValue: false, description: 'Build B2B Agent Watcher')
        booleanParam(name: 'cleanBuild', defaultValue: false, description: 'Clean Build')
        booleanParam(name: 'pushToS3', defaultValue: false, description: 'Push to S3')
        booleanParam(name: 'deploy', defaultValue: true, description: 'Deploy in machine')
        booleanParam(name: 'dockerHub', defaultValue: false, description: 'Push to Docker Hub')
    }
    stages {
        stage('Create Tag') {
            steps {
                sh "chmod 777 ./scripts/create_tag.sh"
                sh "./scripts/create_tag.sh"
            }
        }
        stage('SCM') {
            steps {
                git branch: "$BRANCH_NAME", url: 'https://github.com/datanimbus/dnio-b2b-manager.git'
            }
        }
        stage('SCM B2B Base Image') {
            steps {
                dir('ds-b2b-base') {
                  git branch: "$BRANCH_NAME", url: 'https://github.com/datanimbus/dnio-b2b-base.git'
                }
            }
        }
        stage('SCM FaaS Base Image') {
            steps {
                dir('ds-faas') {
                  git branch: "$BRANCH_NAME", url: 'https://github.com/datanimbus/dnio-faas-base.git'
                }
            }
        }
        stage('SCM Agent') {
            when {
                expression {
                    params.buildAgent  == true
                }
            }
            steps {
                dir('ds-agent') {
                  git branch: "$BRANCH_NAME", url: 'https://github.com/datanimbus/dnio-agent.git'
                }
            }
        }
        stage('SCM Agent Watcher') {
            when {
                expression {
                    params.buildAgentWatcher  == true
                }
            }
            steps {
                dir('ds-agent-watcher') {
                  git branch: "$BRANCH_NAME", url: 'https://github.com/datanimbus/dnio-agent-watcher.git'
                }
            }
        }
        stage('Build') {
            steps {
                sh "chmod 777 ./scripts/build.sh"
                sh "./scripts/build.sh"
            }
        }
        stage('Prepare YAML') {
            steps {
                sh "chmod 777 ./scripts/prepare_yaml.sh"
                sh "./scripts/prepare_yaml.sh"
            }
        }
        stage('Push to ECR') {
            steps {
                sh "chmod 777 ./scripts/push_ecr.sh"
                sh "./scripts/push_ecr.sh"
            }
        }
        stage('Deploy') {
            when {
                expression {
                    params.deploy == true
                }
            }
            steps {
                sh "chmod 777 ./scripts/deploy.sh"
                sh "./scripts/deploy.sh"
            }
        }
        stage('Push to Docker Hub') {
            when {
                expression {
                    params.dockerHub  == true
                }
            }
            steps {
                sh "chmod 777 ./scripts/push_hub.sh"
                sh "./scripts/push_hub.sh"
            }
        }
        stage('Save to S3') {
            when {
                expression {
                    params.pushToS3  == true || params.dockerHub  == true
                }
            }
            steps {
                sh "chmod 777 ./scripts/push_s3.sh"
                sh "./scripts/push_s3.sh"
            }
        }
        stage('Clean Up') {
            steps {
                sh "chmod 777 ./scripts/cleanup.sh"
                sh "./scripts/cleanup.sh"
            }
        }
    }
}