import { ChangeDetectionStrategy, Component, ViewEncapsulation, OnInit, OnDestroy, inject, ChangeDetectorRef } from '@angular/core';
import { Router, RouterOutlet, NavigationEnd, ActivatedRoute, PRIMARY_OUTLET, RouterLink, RouterLinkActive } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatInputModule } from '@angular/material/input';
import { NgIf, NgClass } from '@angular/common';
import { Subject } from 'rxjs';
import { filter, map, takeUntil, startWith } from 'rxjs/operators';
import { MyAgentsListComponent } from './my-agents-list/my-agents-list.component';
import { AgentFormComponent } from './agent-form/agent-form.component';
import { MyRoomsComponent } from './my-rooms/my-rooms.component';

@Component({
    selector     : 'my-agents',
    standalone   : true,
    templateUrl  : './my-agents.component.html',
    encapsulation: ViewEncapsulation.None,
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [
        RouterOutlet,
        MatIconModule,
        MatFormFieldModule,
        MatSelectModule,
        MatSlideToggleModule,
        MatInputModule,

        NgIf,
        NgClass,
        RouterLink,
        RouterLinkActive
    ]
})
export class MyAgentsComponent implements OnInit, OnDestroy
{
    private _router = inject(Router);
    private _activatedRoute = inject(ActivatedRoute);
    private _cdr = inject(ChangeDetectorRef);
    private _unsubscribeAll: Subject<any> = new Subject<any>();

    showFilters: boolean = false;
    showPageHeader: boolean = true;
    showAddAgentButton: boolean = false;
    showNavigationTabs: boolean = false;

    categories = [
        { slug: 'TRAVEL', title: 'Travel' },
        { slug: 'SOCIAL_MEDIA', title: 'Social Media' },
        { slug: 'CRYPTO', title: 'Crypto' },
        { slug: 'CONTENT_CREATION', title: 'Content Creation' },
        { slug: 'DATA_ANALYTICS', title: 'Data Analytics' },
        { slug: 'MARKET_INTELLIGENCE', title: 'Market Intelligence' },
        { slug: 'SECURITY', title: 'Security' },
    ];

    hideOfflineAgents = false;

    /**
     * Constructor
     */
    constructor() { }

    ngOnInit(): void {
        this._router.events.pipe(
            filter(event => event instanceof NavigationEnd),
            startWith(null),
            map(() => {
                let route = this._activatedRoute;
                while (route.firstChild) {
                    route = route.firstChild;
                }
                return route;
            }),
            filter(route => route.outlet === PRIMARY_OUTLET),
            takeUntil(this._unsubscribeAll)
        ).subscribe(route => {
            const currentComponent = route.component as any;
            this.showFilters = currentComponent === MyAgentsListComponent;
            this.showPageHeader = currentComponent === MyAgentsListComponent || currentComponent === AgentFormComponent;
            this.showAddAgentButton = currentComponent === MyAgentsListComponent;
            this.showNavigationTabs = currentComponent === MyAgentsListComponent || currentComponent === MyRoomsComponent;
            this._cdr.markForCheck();
        });
    }

    ngOnDestroy(): void {
        this._unsubscribeAll.next(null);
        this._unsubscribeAll.complete();
    }

    // -----------------------------------------------------------------------------------------------------
    // @ Public methods
    // -----------------------------------------------------------------------------------------------------

    OfflineAgent(event: any): void {
        this.hideOfflineAgents = event.checked;
        console.log('Hide offline agents toggled in parent:', this.hideOfflineAgents);
    }

    filterByCategory(event: any): void {
        const selected = event.value;
        console.log('Selected category in parent:', selected);
    }

    filterByQuery(query: string): void {
        console.log('Search query in parent:', query);
    }

    /**
     * Track by function for ngFor loops.
     */
    trackByFn(index: number, item: any): any {
        return item.slug || index;
    }
}
