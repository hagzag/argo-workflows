import {Pipeline} from '../../../../models/pipeline';
import {Metrics, Step} from '../../../../models/step';
import {Graph} from '../../../shared/components/graph/types';
import {Icon} from '../../../shared/components/icon';
import {totalRate} from '../total-rate';

type Type = '' | 'cat' | 'code' | 'container' | 'dedupe' | 'expand' | 'filter' | 'flatten' | 'git' | 'group' | 'map' | 'split';

const stepIcon = (type: Type): Icon => {
    switch (type) {
        case 'cat':
        case 'map':
            return 'chevron-right';
        case 'code':
            return 'code';
        case 'container':
            return 'cube';
        case 'dedupe':
            return 'filter';
        case 'expand':
            return 'expand';
        case 'filter':
            return 'filter';
        case 'flatten':
            return 'compress';
        case 'git':
            return 'git-alt';
        case 'group':
            return 'object-group';
        case 'split':
            return 'object-ungroup';
        default:
            return 'square';
    }
};

const pendingSymbol = '◷';

function formatRates(metrics: Metrics, replicas: number): string {
    const rates = Object.entries(metrics || {})
        // the rate will remain after scale-down, so we must filter out, as it'll be wrong
        .filter(([replica]) => parseInt(replica, 10) < replicas);
    return rates.length > 0 ? 'Δ' + totalRate(metrics, replicas) : '';
}

function formatPending(pending: number) {
    return pending ? ' ' + pendingSymbol + pending.toLocaleString() + ' ' : '';
}

export const graph = (pipeline: Pipeline, steps: Step[]) => {
    const g = new Graph();

    steps.forEach(step => {
        const spec = step.spec;
        const stepId = 'step/' + spec.name;
        const status = step.status || {phase: '', replicas: 0};

        const type: Type = spec.cat
            ? 'cat'
            : spec.code
            ? 'code'
            : spec.container
            ? 'container'
            : spec.dedupe
            ? 'dedupe'
            : spec.expand
            ? 'expand'
            : spec.filter
            ? 'filter'
            : spec.git
            ? 'git'
            : spec.flatten
            ? 'flatten'
            : spec.group
            ? 'group'
            : spec.map
            ? 'map'
            : '';

        const nodeLabel = status.replicas !== 1 ? spec.name + ' (x' + (status.replicas || 0) + ')' : spec.name;
        g.nodes.set(stepId, {genre: type, label: nodeLabel, icon: stepIcon(type), classNames: status.phase});

        const classNames = status.phase === 'Running' ? 'flow' : '';
        (spec.sources || []).forEach(x => {
            const ss = (status.sourceStatuses || {})[x.name || ''] || {};
            const label = formatPending(ss.pending) + formatRates(ss.metrics, step.status.replicas);
            if (x.cron) {
                const cronId = 'cron/' + stepId + '/sources/' + x.cron.schedule;
                g.nodes.set(cronId, {genre: 'cron', icon: 'clock', label: x.cron.schedule});
                g.edges.set({v: cronId, w: stepId}, {classNames, label});
            } else if (x.db) {
                const id = 'db/' + +stepId + '/sources/' + x.name;
                g.nodes.set(id, {genre: 'db', icon: 'database', label: x.name});
                g.edges.set({v: id, w: stepId}, {classNames, label});
            } else if (x.kafka) {
                const kafkaId = x.kafka.name || x.kafka.url || 'default';
                const topicId = 'kafka/' + kafkaId + '/' + x.kafka.topic;
                g.nodes.set(topicId, {genre: 'kafka', icon: 'stream', label: x.kafka.topic});
                g.edges.set({v: topicId, w: stepId}, {classNames, label});
            } else if (x.stan) {
                const stanId = x.stan.name || x.stan.url || 'default';
                const subjectId = 'stan/' + stanId + '/' + x.stan.subject;
                g.nodes.set(subjectId, {genre: 'stan', icon: 'stream', label: x.stan.subject});
                g.edges.set({v: subjectId, w: stepId}, {classNames, label});
            } else if (x.http) {
                const y = new URL('http://' + (x.http.serviceName || pipeline.metadata.name + '-' + step.spec.name) + '/sources/' + x.name);
                const subjectId = 'http/' + y;
                g.nodes.set(subjectId, {genre: 'http', icon: 'cloud', label: y.hostname});
                g.edges.set({v: subjectId, w: stepId}, {classNames, label});
            } else if (x.s3) {
                const bucket = x.s3.bucket;
                const id = 's3/' + bucket;
                g.nodes.set(id, {genre: 's3', icon: 'hdd', label: bucket});
                g.edges.set({v: id, w: stepId}, {classNames, label});
            } else {
                const id = 'unknown/' + stepId + '/sources/' + x.name;
                g.nodes.set(id, {genre: 'unknown', icon: 'square', label: x.name});
                g.edges.set({v: id, w: stepId}, {classNames, label});
            }
        });
        (spec.sinks || []).forEach(x => {
            const ss = (status.sinkStatuses || {})[x.name || ''] || {};
            const label = formatRates(ss.metrics, step.status.replicas);
            if (x.db) {
                const id = 'db/' + stepId + '/sinks/' + x.name;
                g.nodes.set(id, {genre: 'db', icon: 'database', label: x.name});
                g.edges.set({v: stepId, w: id}, {classNames, label});
            } else if (x.kafka) {
                const kafkaId = x.kafka.name || x.kafka.url || 'default';
                const topicId = 'kafka/' + kafkaId + '/' + x.kafka.topic;
                g.nodes.set(topicId, {genre: 'kafka', icon: 'stream', label: x.kafka.topic});
                g.edges.set({v: stepId, w: topicId}, {classNames, label});
            } else if (x.log) {
                const logId = 'log/' + stepId + '/sinks/' + x.name;
                g.nodes.set(logId, {genre: 'log', icon: 'file-alt', label: 'log'});
                g.edges.set({v: stepId, w: logId}, {classNames, label});
            } else if (x.stan) {
                const stanId = x.stan.name || x.stan.url || 'default';
                const subjectId = 'stan/' + stanId + '/' + x.stan.subject;
                g.nodes.set(subjectId, {genre: 'stan', icon: 'stream', label: x.stan.subject});
                g.edges.set({v: stepId, w: subjectId}, {classNames, label});
            } else if (x.http) {
                const y = new URL(x.http.url);
                const subjectId = 'http/' + y;
                g.nodes.set(subjectId, {genre: 'http', icon: 'cloud', label: y.hostname});
                g.edges.set({v: stepId, w: subjectId}, {classNames, label});
            } else if (x.s3) {
                const bucket = x.s3.bucket;
                const id = 's3/' + bucket;
                g.nodes.set(id, {genre: 's3', icon: 'hdd', label: bucket});
                g.edges.set({v: stepId, w: id}, {classNames, label});
            } else {
                const id = 'unknown/' + stepId + '/sinks/' + x.name;
                g.nodes.set(id, {genre: 'unknown', icon: 'square', label: x.name});
                g.edges.set({v: stepId, w: id}, {classNames, label});
            }
        });
    });
    return g;
};
