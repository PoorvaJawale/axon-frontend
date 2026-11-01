FROM n8nio/runners:2.45.7@sha256:2f07088829b6a1df2b6a84746bb8b32c1eaef270315fb5466aa01b1045e9b300
USER root
COPY task-runners.json /etc/n8n-task-runners.json
RUN chmod 0444 /etc/n8n-task-runners.json
USER runner
