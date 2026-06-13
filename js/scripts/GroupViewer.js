import React from 'react'
import Classnames from 'classnames'

import withNavigateHook from './nagivateHook'


class GroupViewer extends React.Component {
    constructor(props) {
        super(props)
        this.state = {
            showForm: false,
            form: { title: '', username: '', password: '', url: '', notes: '' },
            saving: false,
        }
        this.onNewEntry = this.onNewEntry.bind(this)
        this.onFormChange = this.onFormChange.bind(this)
        this.onSubmit = this.onSubmit.bind(this)
        this.onCancel = this.onCancel.bind(this)
    }

    getIcon(element) {
        if (element.custom_icon_uuid)
            return <img className="kp-icon" src={'api/v1/icon/' + encodeURIComponent(element.custom_icon_uuid)}/>
        else if (element.icon)
            return <img className="kp-icon" src={'assets/img/icons/' + encodeURIComponent(element.icon) + '.png'}/>
    }

    onNewEntry() {
        this.setState({ showForm: true, form: { title: '', username: '', password: '', url: '', notes: '' } })
    }

    onCancel() {
        this.setState({ showForm: false })
    }

    onFormChange(field, e) {
        this.setState(prev => ({ form: { ...prev.form, [field]: e.target.value } }))
    }

    onSubmit(e) {
        e.preventDefault()
        if (!this.props.group) return
        this.setState({ saving: true })

        KeePass4Web.fetch('entry', {
            method: 'POST',
            data: {
                group_id: this.props.group.id,
                ...this.state.form,
            },
            success: (data) => {
                this.setState({ showForm: false, saving: false })
                if (this.props.onEntryCreated) this.props.onEntryCreated(data && data.id)
            },
            error: (err) => {
                this.setState({ saving: false })
                KeePass4Web.error.call(this, err)
            },
        })
    }

    render() {
        const classes = Classnames({
            'panel': true,
            'panel-default': true,
            'loading-mask': this.props.mask,
        })

        if (!this.props.group) return (<div className={classes}></div>)

        const group = this.props.group

        let entries = []
        for (var i in group.entries) {
            let entry = group.entries[i]

            entries.push(
                <tr key={i} onClick={this.props.onSelect.bind(this, entry)}>
                    <td className="kp-wrap">
                        {this.getIcon(entry)}
                        {entry.title}
                    </td>
                    <td className="kp-wrap">
                        {entry.username}
                    </td>
                    <td>
                        <button
                            className="btn btn-danger btn-xs"
                            title="Delete entry"
                            onClick={(ev) => { ev.stopPropagation(); this.props.onDeleteEntry && this.props.onDeleteEntry(entry) }}
                        >
                            <span className="glyphicon glyphicon-trash"></span>
                        </button>
                    </td>
                </tr>
            )
        }

        let newEntryForm = null
        if (this.state.showForm) {
            newEntryForm = (
                <tr key="new-entry-form">
                    <td colSpan="3">
                        <form onSubmit={this.onSubmit}>
                            <div className="form-group form-group-sm">
                                <input className="form-control" placeholder="Title" required
                                    value={this.state.form.title} onChange={this.onFormChange.bind(this, 'title')} />
                            </div>
                            <div className="form-group form-group-sm">
                                <input className="form-control" placeholder="Username"
                                    value={this.state.form.username} onChange={this.onFormChange.bind(this, 'username')} />
                            </div>
                            <div className="form-group form-group-sm">
                                <input className="form-control" type="password" placeholder="Password"
                                    value={this.state.form.password} onChange={this.onFormChange.bind(this, 'password')} />
                            </div>
                            <div className="form-group form-group-sm">
                                <input className="form-control" placeholder="URL"
                                    value={this.state.form.url} onChange={this.onFormChange.bind(this, 'url')} />
                            </div>
                            <div className="form-group form-group-sm">
                                <input className="form-control" placeholder="Notes"
                                    value={this.state.form.notes} onChange={this.onFormChange.bind(this, 'notes')} />
                            </div>
                            <div className="btn-group">
                                <button type="submit" className="btn btn-primary btn-sm" disabled={this.state.saving}>
                                    {this.state.saving ? 'Saving…' : 'Save'}
                                </button>
                                <button type="button" className="btn btn-default btn-sm" onClick={this.onCancel}>
                                    Cancel
                                </button>
                            </div>
                        </form>
                    </td>
                </tr>
            )
        }

        return (
            <div className={classes}>
                <div className="panel-heading">
                    {this.getIcon(group)}
                    {group.title}
                    <button
                        className="btn btn-success btn-xs pull-right"
                        onClick={this.onNewEntry}
                        title="New entry"
                    >
                        <span className="glyphicon glyphicon-plus"></span> New Entry
                    </button>
                </div>
                <div className="panel-body">
                    <table className="table table-hover table-condensed kp-table">
                        <thead>
                        <tr>
                            <th>Entry Name</th>
                            <th>Username</th>
                            <th></th>
                        </tr>
                        </thead>
                        <tbody className="groupview-body">
                        {entries}
                        {newEntryForm}
                        </tbody>
                    </table>
                </div>
            </div>
        )
    }
}

export default withNavigateHook(GroupViewer)
